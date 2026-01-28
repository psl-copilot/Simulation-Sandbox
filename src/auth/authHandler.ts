// SPDX-License-Identifier: Apache-2.0
import { decode } from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { loggerService } from '..';

interface JwtPayloadWithClaims {
  claims?: string[];
}

export const tokenHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const logContext = 'tokenHandler()';
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    const [, token] = authHeader.split(' ');
    const decoded = decode(token) as JwtPayloadWithClaims | null;
    loggerService.log(`Decoded token: ${JSON.stringify(decoded)}`, logContext);

    const claims = decoded?.claims ?? [];
    loggerService.log(`Token claims: ${claims.join(', ')}`, logContext);

    if (!claims.includes('editor')) {
      reply.code(403).send({ error: 'Unauthorized: Missing Editor Claim' });
      return;
    }

    loggerService.log('Authenticated (editor)', logContext);
  } catch (error) {
    loggerService.error(String(error), logContext);
    reply.code(401).send({ error: 'Unauthorized' });
  }
};
