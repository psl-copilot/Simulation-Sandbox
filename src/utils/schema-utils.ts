// SPDX-License-Identifier: Apache-2.0
import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';
import type { FastifySchema } from 'fastify/types/schema';
import type { TSchema } from '@sinclair/typebox';
import { tokenHandler } from '../auth/authHandler';
import { loggerService } from '../index';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => void | Promise<void>;

export const SetOptionsBodyAndParams = (
  handler: RouteHandlerMethod,
  bodySchema?: TSchema,
  querySchema?: TSchema,
  responseSchema?: TSchema
): {
  preHandler: PreHandler[];
  handler: RouteHandlerMethod;
  schema: FastifySchema;
} => {
  loggerService.debug(`Auth ENABLED for ${handler.name}`);

  return {
    preHandler: [tokenHandler],
    handler,
    schema: {
      ...(querySchema && { querystring: querySchema }),
      ...(bodySchema && { body: bodySchema }),
      ...(responseSchema && {
        response: {
          200: responseSchema,
          500: responseSchema,
        },
      }),
    },
  };
};
