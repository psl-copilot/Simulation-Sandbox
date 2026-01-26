// SPDX-License-Identifier: Apache-2.0

import type { FastifyInstance } from 'fastify';
import { handleHealthCheck } from './app.controller';
import {
  BootstrapBodySchema,
  BootstrapResponseSchema,
  PopulateBodySchema,
  PopulateResponseSchema,
  PromoteBodySchema,
  PromoteResponseSchema,
  FetchLatestTestReportResponseSchema,
} from './schemas';
import {
  bootstrapHandler,
  populateHandler,
  promoteHandler,
  fetchLatestTestReportHandler,
} from './services/github.logic.service';
import { SetOptionsBodyAndParams } from './utils/schema-utils';
import { FetchLatestTestReportQuerySchema } from './schemas/fetchLatestTestReportSchema';

function Routes(fastify: FastifyInstance): void {
  fastify.get('/', handleHealthCheck);

  fastify.get('/health', handleHealthCheck);

  fastify.post('/v1/bootstrap', {
    ...SetOptionsBodyAndParams(bootstrapHandler, BootstrapBodySchema, BootstrapResponseSchema),
  });

  fastify.post('/v1/populate', {
    ...SetOptionsBodyAndParams(populateHandler, PopulateBodySchema, PopulateResponseSchema),
  });

  fastify.post('/v1/promote', {
    ...SetOptionsBodyAndParams(promoteHandler, PromoteBodySchema, PromoteResponseSchema),
  });

  fastify.get('/v1/report', {
    schema: {
      querystring: FetchLatestTestReportQuerySchema,
      response: {
        200: FetchLatestTestReportResponseSchema,
      },
    },
    handler: fetchLatestTestReportHandler,
  });
}

export default Routes;
