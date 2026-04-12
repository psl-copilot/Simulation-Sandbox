// SPDX-License-Identifier: Apache-2.0

import type { FastifyInstance } from 'fastify';
import { handleHealthCheck } from './app.controller';
import {
  BootstrapBodySchema,
  BootstrapResponseSchema,
  PopulateBodySchema,
  PopulateResponseSchema,
  SaveConfigurationBodySchema,
  SaveConfigurationResponseSchema,
  MaskPreviewBodySchema,
  MaskPreviewResponseSchema,
  PayloadViewerParamsSchema,
  PayloadViewerResponseSchema,
  IngestBodySchema,
  IngestResponseSchema,
} from './schemas';
import { bootstrapHandler, populateHandler } from './services/github.logic.service';
import {
  saveConfigurationHandler,
  maskPreviewHandler,
  payloadViewerHandler,
  ingestHandler,
} from './services/sdl.service';
import { SetOptionsBodyAndParams } from './utils/schema-utils';

function Routes(fastify: FastifyInstance): void {
  fastify.get('/', handleHealthCheck);

  fastify.get('/health', handleHealthCheck);

  fastify.post('/v1/bootstrap', {
    ...SetOptionsBodyAndParams(bootstrapHandler, BootstrapBodySchema, BootstrapResponseSchema),
  });

  fastify.post('/v1/populate', {
    ...SetOptionsBodyAndParams(populateHandler, PopulateBodySchema, PopulateResponseSchema),
  });

  // SDL — Step 2: Configure & Preview
  fastify.post('/v1/sdl/configuration', {
    ...SetOptionsBodyAndParams(
      saveConfigurationHandler,
      SaveConfigurationBodySchema,
      SaveConfigurationResponseSchema
    ),
  });

  fastify.post('/v1/sdl/mask-preview', {
    ...SetOptionsBodyAndParams(
      maskPreviewHandler,
      MaskPreviewBodySchema,
      MaskPreviewResponseSchema
    ),
  });

  fastify.get('/v1/sdl/payload/:txtp/:version', {
    schema: {
      params: PayloadViewerParamsSchema,
      response: { 200: PayloadViewerResponseSchema },
    },
    handler: payloadViewerHandler,
  });

  fastify.post('/v1/sdl/ingest', {
    ...SetOptionsBodyAndParams(ingestHandler, IngestBodySchema, IngestResponseSchema),
  });
}

export default Routes;
