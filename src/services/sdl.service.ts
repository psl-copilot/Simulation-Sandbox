// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { loggerService } from '../index';
import type {
  SaveConfigurationBody,
  MaskPreviewBody,
  PayloadViewerParams,
  IngestBody,
} from '../schemas';
import type {
  MaskingConfiguration,
  IngestionLog,
} from '../interfaces';
import { MaskingMethod } from '../interfaces';

// In-memory stores (keyed by `txtp:version`)
const configurationStore = new Map<string, MaskingConfiguration>();
const ingestionLogStore: IngestionLog[] = [];

const configKey = (txtp: string, version: string): string => `${txtp}:${version}`;

// ─── Masking engine ─────────────────────────────────────────────────────────

export const applyMaskingMethod = (value: string, method: string): string => {
  switch (method) {
    case MaskingMethod.REDACT:
      return '[REDACTED]';

    case MaskingMethod.TOKENIZE: {
      const token = Buffer.from(value).toString('base64').slice(0, 8).toUpperCase();
      return `TKN-${token}`;
    }

    case MaskingMethod.HASH:
      return createHash('sha256').update(value).digest('hex');

    case MaskingMethod.PARTIAL_MASK: {
      if (value.length <= 4) {
        return '*'.repeat(value.length);
      }
      const visible = value.slice(-4);
      return `${'*'.repeat(value.length - 4)}${visible}`;
    }

    case MaskingMethod.GENERALIZE:
      return `[${typeof value}]`;

    default:
      throw new Error(`Unknown masking method: ${method}`);
  }
};

// ─── File schema validation ──────────────────────────────────────────────────

const REQUIRED_TRANSACTION_FIELDS = ['txtp', 'version', 'records'];

export const validateTransactionFileSchema = (data: Record<string, unknown>): string[] => {
  const errors: string[] = [];

  for (const field of REQUIRED_TRANSACTION_FIELDS) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const records = data['records'];
  if (records === undefined || records === null || !Array.isArray(records)) {
    errors.push('Field "records" must be an array');
  } else if (records.length === 0) {
    errors.push('Field "records" must not be empty');
  }

  if ('txtp' in data && typeof data['txtp'] !== 'string') {
    errors.push('Field "txtp" must be a string');
  }

  if ('version' in data && typeof data['version'] !== 'string') {
    errors.push('Field "version" must be a string');
  }

  return errors;
};

// ─── TRS notification hook ───────────────────────────────────────────────────

export const notifyTrs = async (config: MaskingConfiguration): Promise<void> => {
  const trsUrl = process.env.TRS_SIGNAL_URL;
  if (!trsUrl) {
    loggerService.log(`TRS signal skipped (TRS_SIGNAL_URL not configured) for ${config.txtp}:${config.version}`);
    return;
  }

  try {
    const res = await fetch(trsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txtp: config.txtp, version: config.version, updatedAt: config.updatedAt }),
    });
    if (!res.ok) {
      loggerService.error(`TRS signal failed for ${config.txtp}:${config.version}: ${await res.text()}`);
    } else {
      loggerService.log(`TRS signaled for ${config.txtp}:${config.version}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggerService.error(`TRS signal error for ${config.txtp}:${config.version}: ${message}`);
  }
};

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * POST /v1/sdl/configuration
 * Saves (upserts) a masking configuration. Overwrites duplicate txtp+version.
 * Triggers TRS post-save hook.
 */
export const saveConfigurationHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { txtp, version, fieldMasks, payload } = request.body as SaveConfigurationBody;
    const key = configKey(txtp, version);
    const overwritten = configurationStore.has(key);
    const now = new Date().toISOString();
    const existing = configurationStore.get(key);

    const config: MaskingConfiguration = {
      txtp,
      version,
      fieldMasks,
      payload,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    configurationStore.set(key, config);

    loggerService.log(
      `Configuration ${overwritten ? 'overwritten' : 'saved'}: ${txtp}:${version} (${fieldMasks.length} field masks)`
    );

    await notifyTrs(config);

    reply.status(200).send({
      success: true,
      message: `Configuration ${overwritten ? 'overwritten' : 'saved'}: ${txtp} v${version}`,
      overwritten,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggerService.error(message);
    reply.status(500).send({ success: false, message, overwritten: false });
  }
};

/**
 * POST /v1/sdl/mask-preview
 * Returns a live preview of a masked value using the requested masking method.
 */
export const maskPreviewHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { value, maskingMethod } = request.body as MaskPreviewBody;

    if (typeof value !== 'string') {
      reply.status(400).send({ success: false, message: 'Invalid or missing "value"' });
      return;
    }

    const masked = applyMaskingMethod(value, maskingMethod);

    reply.status(200).send({
      original: value,
      masked,
      maskingMethod,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggerService.error(message);
    reply.status(500).send({ success: false, message });
  }
};

/**
 * GET /v1/sdl/payload/:txtp/:version
 * Returns a read-only JSON payload viewer for a stored configuration.
 */
export const payloadViewerHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { txtp, version } = request.params as PayloadViewerParams;
    const key = configKey(txtp, version);
    const config = configurationStore.get(key);

    if (!config) {
      reply.status(404).send({ success: false, message: `Configuration not found: ${txtp} v${version}` });
      return;
    }

    reply.status(200).send({
      txtp: config.txtp,
      version: config.version,
      payload: config.payload,
      fieldMasks: config.fieldMasks,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggerService.error(message);
    reply.status(500).send({ success: false, message });
  }
};

/**
 * POST /v1/sdl/ingest
 * Ingests a transaction data file: validates schema, stores payload, logs event.
 */
export const ingestHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const timestamp = new Date().toISOString();

  try {
    const body = request.body as IngestBody;
    const { txtp, version, records } = body;

    const schemaErrors = validateTransactionFileSchema(body as unknown as Record<string, unknown>);
    if (schemaErrors.length > 0) {
      const log: IngestionLog = {
        txtp,
        version,
        timestamp,
        recordCount: 0,
        status: 'error',
        message: schemaErrors.join('; '),
      };
      ingestionLogStore.push(log);
      loggerService.error(`Ingestion schema validation failed [${txtp}:${version}]: ${log.message}`);
      reply.status(400).send({ success: false, message: log.message, timestamp, recordCount: 0 });
      return;
    }

    const log: IngestionLog = {
      txtp,
      version,
      timestamp,
      recordCount: records.length,
      status: 'success',
    };
    ingestionLogStore.push(log);

    loggerService.log(
      `Ingestion event: txtp=${txtp}, version=${version}, records=${records.length}, timestamp=${timestamp}`
    );

    reply.status(200).send({
      success: true,
      message: `Ingested ${records.length} records for ${txtp} v${version}`,
      timestamp,
      recordCount: records.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const log: IngestionLog = {
      txtp: '',
      version: '',
      timestamp,
      recordCount: 0,
      status: 'error',
      message,
    };
    ingestionLogStore.push(log);
    loggerService.error(message);
    reply.status(500).send({ success: false, message, timestamp, recordCount: 0 });
  }
};

// ─── Exported store accessors (for testing) ──────────────────────────────────
export const getConfigurationStore = (): Map<string, MaskingConfiguration> => configurationStore;
export const getIngestionLogStore = (): IngestionLog[] => ingestionLogStore;
export const clearStores = (): void => {
  configurationStore.clear();
  ingestionLogStore.length = 0;
};
