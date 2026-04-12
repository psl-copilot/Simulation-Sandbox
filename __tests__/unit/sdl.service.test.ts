// SPDX-License-Identifier: Apache-2.0

import type { FastifyRequest, FastifyReply } from 'fastify';

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/index', () => ({
  configuration: {},
  loggerService: mockLoggerService,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  applyMaskingMethod,
  validateTransactionFileSchema,
  notifyTrs,
  saveConfigurationHandler,
  maskPreviewHandler,
  payloadViewerHandler,
  ingestHandler,
  clearStores,
  getConfigurationStore,
  getIngestionLogStore,
} from '../../src/services/sdl.service';
import { MaskingMethod } from '../../src/interfaces';

const createMockReply = (): FastifyReply =>
  ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }) as unknown as FastifyReply;

const createMockRequest = (body: unknown, params?: unknown): FastifyRequest =>
  ({ body, params }) as FastifyRequest;

beforeEach(() => {
  clearStores();
  jest.clearAllMocks();
  delete process.env.TRS_SIGNAL_URL;
});

// ─── applyMaskingMethod ───────────────────────────────────────────────────────

describe('applyMaskingMethod', () => {
  it('redacts a value', () => {
    expect(applyMaskingMethod('secret', MaskingMethod.REDACT)).toBe('[REDACTED]');
  });

  it('tokenizes a value', () => {
    const result = applyMaskingMethod('hello', MaskingMethod.TOKENIZE);
    expect(result).toMatch(/^TKN-/);
  });

  it('hashes a value with SHA-256', () => {
    const result = applyMaskingMethod('hello', MaskingMethod.HASH);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('partial-masks a long value showing last 4 chars', () => {
    const result = applyMaskingMethod('1234567890', MaskingMethod.PARTIAL_MASK);
    expect(result).toBe('******7890');
  });

  it('partial-masks a short value (≤4 chars) fully', () => {
    expect(applyMaskingMethod('123', MaskingMethod.PARTIAL_MASK)).toBe('***');
    expect(applyMaskingMethod('1234', MaskingMethod.PARTIAL_MASK)).toBe('****');
  });

  it('generalizes a value', () => {
    expect(applyMaskingMethod('hello', MaskingMethod.GENERALIZE)).toBe('[string]');
  });

  it('throws for an unknown masking method', () => {
    expect(() => applyMaskingMethod('val', 'UNKNOWN')).toThrow('Unknown masking method: UNKNOWN');
  });
});

// ─── validateTransactionFileSchema ───────────────────────────────────────────

describe('validateTransactionFileSchema', () => {
  it('returns no errors for a valid file', () => {
    const errors = validateTransactionFileSchema({
      txtp: 'pain001',
      version: '1.0',
      records: [{ id: 1 }],
    });
    expect(errors).toHaveLength(0);
  });

  it('returns errors for missing required fields', () => {
    const errors = validateTransactionFileSchema({} as any);
    expect(errors).toContain('Missing required field: txtp');
    expect(errors).toContain('Missing required field: version');
    expect(errors).toContain('Missing required field: records');
  });

  it('returns error when records is null', () => {
    const errors = validateTransactionFileSchema({ txtp: 'a', version: '1', records: null } as unknown as Record<string, unknown>);
    expect(errors).toContain('Field "records" must be an array');
  });

  it('returns error when records is not an array', () => {
    const errors = validateTransactionFileSchema({ txtp: 'a', version: '1', records: 'bad' } as any);
    expect(errors).toContain('Field "records" must be an array');
  });

  it('returns error when records array is empty', () => {
    const errors = validateTransactionFileSchema({ txtp: 'a', version: '1', records: [] });
    expect(errors).toContain('Field "records" must not be empty');
  });

  it('returns error when txtp is not a string', () => {
    const errors = validateTransactionFileSchema({ txtp: 42, version: '1', records: [{}] } as any);
    expect(errors).toContain('Field "txtp" must be a string');
  });

  it('returns error when version is not a string', () => {
    const errors = validateTransactionFileSchema({ txtp: 'a', version: 99, records: [{}] } as any);
    expect(errors).toContain('Field "version" must be a string');
  });
});

// ─── notifyTrs ────────────────────────────────────────────────────────────────

describe('notifyTrs', () => {
  const config = {
    txtp: 'pain001',
    version: '1.0',
    fieldMasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('skips when TRS_SIGNAL_URL is not set', async () => {
    await notifyTrs(config);
    expect(mockLoggerService.log).toHaveBeenCalledWith(
      expect.stringContaining('TRS signal skipped')
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends POST to TRS_SIGNAL_URL on success', async () => {
    process.env.TRS_SIGNAL_URL = 'http://trs.example.com/signal';
    mockFetch.mockResolvedValueOnce({ ok: true });
    await notifyTrs(config);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://trs.example.com/signal',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockLoggerService.log).toHaveBeenCalledWith(expect.stringContaining('TRS signaled'));
  });

  it('logs error when TRS returns non-ok response', async () => {
    process.env.TRS_SIGNAL_URL = 'http://trs.example.com/signal';
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'TRS error' });
    await notifyTrs(config);
    expect(mockLoggerService.error).toHaveBeenCalledWith(expect.stringContaining('TRS signal failed'));
  });

  it('logs error when TRS fetch throws', async () => {
    process.env.TRS_SIGNAL_URL = 'http://trs.example.com/signal';
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    await notifyTrs(config);
    expect(mockLoggerService.error).toHaveBeenCalledWith(expect.stringContaining('TRS signal error'));
  });

  it('handles non-Error thrown from TRS fetch', async () => {
    process.env.TRS_SIGNAL_URL = 'http://trs.example.com/signal';
    mockFetch.mockRejectedValueOnce('plain string error');
    await notifyTrs(config);
    expect(mockLoggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('plain string error')
    );
  });
});

// ─── saveConfigurationHandler ─────────────────────────────────────────────────

describe('saveConfigurationHandler', () => {
  it('saves a new configuration and signals TRS (no URL configured)', async () => {
    const req = createMockRequest({
      txtp: 'pain001',
      version: '1.0',
      fieldMasks: [{ fieldPath: 'amount', maskingMethod: 'REDACT' }],
      payload: { amount: 100 },
    });
    const reply = createMockReply();

    await saveConfigurationHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, overwritten: false })
    );
    expect(getConfigurationStore().size).toBe(1);
  });

  it('overwrites an existing configuration (duplicate txtp+version)', async () => {
    const body = {
      txtp: 'pain001',
      version: '1.0',
      fieldMasks: [],
    };
    const req1 = createMockRequest(body);
    const reply1 = createMockReply();
    await saveConfigurationHandler(req1, reply1);

    const req2 = createMockRequest({ ...body, fieldMasks: [{ fieldPath: 'id', maskingMethod: 'HASH' }] });
    const reply2 = createMockReply();
    await saveConfigurationHandler(req2, reply2);

    expect(reply2.status).toHaveBeenCalledWith(200);
    expect(reply2.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, overwritten: true })
    );
    expect(getConfigurationStore().size).toBe(1);
    const saved = getConfigurationStore().get('pain001:1.0');
    expect(saved?.fieldMasks).toHaveLength(1);
  });

  it('preserves createdAt and updates updatedAt on overwrite', async () => {
    const body = { txtp: 'x', version: '2', fieldMasks: [] };
    await saveConfigurationHandler(createMockRequest(body), createMockReply());
    const first = getConfigurationStore().get('x:2');

    await saveConfigurationHandler(createMockRequest(body), createMockReply());
    const second = getConfigurationStore().get('x:2');

    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.updatedAt).not.toBe(second?.createdAt);
  });

  it('returns 500 on unexpected error', async () => {
    const req = { body: null } as FastifyRequest;
    const reply = createMockReply();
    await saveConfigurationHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(500);
  });

  it('sends TRS signal when TRS_SIGNAL_URL is set', async () => {
    process.env.TRS_SIGNAL_URL = 'http://trs/signal';
    mockFetch.mockResolvedValueOnce({ ok: true });
    const req = createMockRequest({ txtp: 'p', version: '1', fieldMasks: [] });
    const reply = createMockReply();
    await saveConfigurationHandler(req, reply);
    expect(mockFetch).toHaveBeenCalledWith('http://trs/signal', expect.anything());
    expect(reply.status).toHaveBeenCalledWith(200);
  });
});

// ─── maskPreviewHandler ───────────────────────────────────────────────────────

describe('maskPreviewHandler', () => {
  it('returns a masked preview for REDACT', async () => {
    const req = createMockRequest({ value: 'sensitiveData', maskingMethod: 'REDACT' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      original: 'sensitiveData',
      masked: '[REDACTED]',
      maskingMethod: 'REDACT',
    });
  });

  it('returns a masked preview for TOKENIZE', async () => {
    const req = createMockRequest({ value: 'hello', maskingMethod: 'TOKENIZE' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.masked).toMatch(/^TKN-/);
  });

  it('returns a masked preview for HASH', async () => {
    const req = createMockRequest({ value: 'hello', maskingMethod: 'HASH' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.masked).toHaveLength(64);
  });

  it('returns a masked preview for PARTIAL_MASK', async () => {
    const req = createMockRequest({ value: '1234567890', maskingMethod: 'PARTIAL_MASK' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.masked).toBe('******7890');
  });

  it('returns a masked preview for GENERALIZE', async () => {
    const req = createMockRequest({ value: 'something', maskingMethod: 'GENERALIZE' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.masked).toBe('[string]');
  });

  it('returns 400 when value is missing (not a string)', async () => {
    const req = createMockRequest({ maskingMethod: 'REDACT' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('"value"') })
    );
  });

  it('returns 500 on unknown masking method', async () => {
    const req = createMockRequest({ value: 'x', maskingMethod: 'UNKNOWN_METHOD' });
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Unknown masking method') })
    );
  });

  it('returns 500 on unexpected error', async () => {
    const req = { body: null } as FastifyRequest;
    const reply = createMockReply();
    await maskPreviewHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// ─── payloadViewerHandler ─────────────────────────────────────────────────────

describe('payloadViewerHandler', () => {
  it('returns 404 when configuration does not exist', async () => {
    const req = createMockRequest({}, { txtp: 'unknown', version: '9.9' });
    const reply = createMockReply();
    await payloadViewerHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('not found') })
    );
  });

  it('returns the stored configuration payload', async () => {
    const body = {
      txtp: 'pain001',
      version: '1.0',
      fieldMasks: [{ fieldPath: 'amount', maskingMethod: 'REDACT' }],
      payload: { amount: 100, currency: 'USD' },
    };
    await saveConfigurationHandler(createMockRequest(body), createMockReply());

    const req = createMockRequest({}, { txtp: 'pain001', version: '1.0' });
    const reply = createMockReply();
    await payloadViewerHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.txtp).toBe('pain001');
    expect(call.payload).toEqual({ amount: 100, currency: 'USD' });
    expect(call.fieldMasks).toHaveLength(1);
    expect(call.createdAt).toBeDefined();
    expect(call.updatedAt).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    const req = { params: null } as FastifyRequest;
    const reply = createMockReply();
    await payloadViewerHandler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// ─── ingestHandler ────────────────────────────────────────────────────────────

describe('ingestHandler', () => {
  it('successfully ingests valid transaction data', async () => {
    const req = createMockRequest({
      txtp: 'pain001',
      version: '1.0',
      records: [{ id: 1, amount: 200 }, { id: 2, amount: 300 }],
    });
    const reply = createMockReply();

    await ingestHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.success).toBe(true);
    expect(call.recordCount).toBe(2);
    expect(call.timestamp).toBeDefined();
    expect(getIngestionLogStore()).toHaveLength(1);
    expect(getIngestionLogStore()[0].status).toBe('success');
  });

  it('returns 400 and logs error for schema validation failure (empty records)', async () => {
    const req = createMockRequest({
      txtp: 'pain001',
      version: '1.0',
      records: [],
    });
    const reply = createMockReply();

    await ingestHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(mockLoggerService.error).toHaveBeenCalled();
    expect(getIngestionLogStore()[0].status).toBe('error');
  });

  it('returns 400 for missing required fields', async () => {
    const req = createMockRequest({});
    const reply = createMockReply();

    await ingestHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    const call = (reply.send as jest.Mock).mock.calls[0][0];
    expect(call.success).toBe(false);
    expect(call.message).toContain('Missing required field');
  });

  it('returns 500 on unexpected error', async () => {
    const req = { body: null } as FastifyRequest;
    const reply = createMockReply();

    await ingestHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(getIngestionLogStore()[0].status).toBe('error');
  });

  it('logs ingestion event with timestamp and record count', async () => {
    const req = createMockRequest({
      txtp: 'pain001',
      version: '2.0',
      records: [{ id: 1 }],
    });
    const reply = createMockReply();
    await ingestHandler(req, reply);

    expect(mockLoggerService.log).toHaveBeenCalledWith(
      expect.stringContaining('records=1')
    );
    expect(mockLoggerService.log).toHaveBeenCalledWith(
      expect.stringContaining('timestamp=')
    );
  });
});

// ─── Store accessors ─────────────────────────────────────────────────────────

describe('store accessors', () => {
  it('clearStores resets both stores', async () => {
    await saveConfigurationHandler(
      createMockRequest({ txtp: 'a', version: '1', fieldMasks: [] }),
      createMockReply()
    );
    await ingestHandler(
      createMockRequest({ txtp: 'a', version: '1', records: [{}] }),
      createMockReply()
    );

    expect(getConfigurationStore().size).toBe(1);
    expect(getIngestionLogStore().length).toBe(1);

    clearStores();

    expect(getConfigurationStore().size).toBe(0);
    expect(getIngestionLogStore().length).toBe(0);
  });
});
