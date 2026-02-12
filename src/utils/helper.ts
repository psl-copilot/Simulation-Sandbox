import * as crypto from 'node:crypto';
import { processorConfig as configuration } from '../config';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TenantCredentials, JWTPayload } from '../interfaces/index';

const key = Buffer.from(configuration.ENCRYPTION_KEY, 'utf8');
const iv = Buffer.from(configuration.ENCRYPTION_IV, 'utf8');

if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes');
}
if (iv.length !== 16) {
  throw new Error('ENCRYPTION_IV must be 16 bytes (32 hex chars)');
}

export function decrypt(text: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(text, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function getTenantToken(tenantId: string): TenantCredentials {
  const encryptedToken = process.env[`GITHUB_TOKEN_${tenantId.toUpperCase()}`];
  const organizationName = process.env[`GITHUB_ORG_NAME_${tenantId.toUpperCase()}`];

  if (!encryptedToken || !organizationName) {
    throw new Error(`Token or Organization not found for tenant: ${tenantId}`);
  }

  try {
    const decryptedToken = decrypt(encryptedToken);
    return { token: decryptedToken, organizationName };
  } catch (error) {
    return { token: encryptedToken, organizationName };
  }
}

export function decodeJWT(token: string): JWTPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const [, payload] = parts;
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    throw new Error(
      `Failed to decode JWT: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error }
    );
  }
}

export async function tokenMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return await reply.status(401).send({ error: 'Authorization header is required' });
    }

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return await reply
        .status(401)
        .send({ error: 'Invalid authorization format. Use: Bearer <token>' });
    }

    const bearerToken = authHeader.slice(7).trim();

    const jwtParts = bearerToken.split('.');
    if (jwtParts.length !== 3 || jwtParts.some((part) => part.length === 0)) {
      return await reply
        .status(401)
        .send({ error: 'Invalid authorization format. Use: Bearer <token>' });
    }

    const payload = decodeJWT(bearerToken);

    if (!payload.tenantId) {
      return await reply.status(400).send({ error: 'tenantId not found in token' });
    }

    const { tenantId } = payload;

    const { token, organizationName } = getTenantToken(tenantId);

    Object.assign(request.headers, {
      de_gh_token: token,
      organization_name: organizationName,
      tenantid: tenantId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return await reply.status(500).send({ error: `Authentication failed: ${errorMessage}` });
  }
}
