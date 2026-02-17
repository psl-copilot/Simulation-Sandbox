// SPDX-License-Identifier: Apache-2.0
import { decode } from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { loggerService } from '..';
import type { JwtPayloadWithClaims } from '../interfaces';

const SPECIAL_ROUTES = new Set(['/api/v1/report', '/api/v1/unit-tests/status']);

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

    const userClaims = decoded?.claims ?? [];

    loggerService.log(`Token claims: ${userClaims.join(', ')}`, logContext);

    const [routePath] = request.url.split('?');
    const isSpecialRoute = SPECIAL_ROUTES.has(routePath);

    let allowedClaims: string[] = ['editor'];

    if (isSpecialRoute) {
      allowedClaims = ['editor', 'approver', 'publisher'];
    }

    const hasAccess = userClaims.some((claim) => allowedClaims.includes(claim));

    if (!hasAccess) {
      reply.code(403).send({
        error: `Unauthorized: Missing required claim ${allowedClaims.join(' or ')} for this route`,
      });
      return;
    }

    loggerService.log('Authenticated', logContext);
  } catch (err: unknown) {
    loggerService.error(err instanceof Error ? err.message : String(err), logContext);

    reply.code(401).send({ error: 'Unauthorized' });
  }
};
