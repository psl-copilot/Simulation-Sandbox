import type { FastifySchema } from 'fastify/types/schema';
import type { RouteHandlerMethod } from 'fastify';
import type { TSchema } from '@sinclair/typebox';

export const SetOptionsBodyAndParams = (
  handler: RouteHandlerMethod,
  bodySchema?: TSchema,
  responseSchema?: TSchema
): { handler: RouteHandlerMethod; schema: FastifySchema } => {
  const body = bodySchema ? { body: bodySchema } : undefined;
  const response = responseSchema
    ? { response: { 200: responseSchema, 500: responseSchema } }
    : undefined;
  const schema: FastifySchema = { ...body, ...response };
  return { handler, schema };
};
