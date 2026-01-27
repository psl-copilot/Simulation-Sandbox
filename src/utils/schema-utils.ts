import type { FastifySchema } from 'fastify/types/schema';
import type { RouteHandlerMethod } from 'fastify';
import type { TSchema } from '@sinclair/typebox';

export const SetOptionsBodyAndParams = (
  handler: RouteHandlerMethod,
  bodySchema?: TSchema,
  querySchema?: TSchema,
  responseSchema?: TSchema
): { handler: RouteHandlerMethod; schema: FastifySchema } => {
  const schema: FastifySchema = {
    ...(bodySchema && { body: bodySchema }),
    ...(querySchema && { querystring: querySchema }),
    ...(responseSchema && {
      response: {
        200: responseSchema,
        500: responseSchema,
      },
    }),
  };

  return { handler, schema };
};
