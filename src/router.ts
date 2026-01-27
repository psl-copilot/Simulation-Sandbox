// SPDX-License-Identifier: Apache-2.0
import type { FastifyInstance } from 'fastify';
import { handleHealthCheck } from './app.controller';

import {
  bootstrapHandler,
  populateHandler,
  promoteHandler,
  fetchLatestTestReportHandler,
  getUnitTestStatusHandler,
} from './services/github.logic.service';

import {
  BootstrapBodySchema,
  BootstrapResponseSchema,
  PopulateBodySchema,
  PopulateResponseSchema,
  PromoteBodySchema,
  PromoteResponseSchema,
  FetchLatestTestReportQuerySchema,
  FetchLatestTestReportResponseSchema,
  UnitTestStatusQuerySchema,
  UnitTestStatusResponseSchema,
} from './schemas';

import { SetOptionsBodyAndParams } from './utils/schema-utils';

function Routes(fastify: FastifyInstance): void {
  fastify.get('/', handleHealthCheck);
  fastify.get('/health', handleHealthCheck);

  fastify.post('/v1/bootstrap', {
    ...SetOptionsBodyAndParams(
      bootstrapHandler,
      BootstrapBodySchema,
      undefined,
      BootstrapResponseSchema
    ),
  });

  fastify.post('/v1/populate', {
    ...SetOptionsBodyAndParams(
      populateHandler,
      PopulateBodySchema,
      undefined,
      PopulateResponseSchema
    ),
  });

  fastify.post('/v1/promote', {
    ...SetOptionsBodyAndParams(promoteHandler, PromoteBodySchema, undefined, PromoteResponseSchema),
  });

  fastify.get('/v1/report', {
    ...SetOptionsBodyAndParams(
      fetchLatestTestReportHandler,
      undefined,
      FetchLatestTestReportQuerySchema,
      FetchLatestTestReportResponseSchema
    ),
  });

  fastify.get('/v1/unit-tests/status', {
    ...SetOptionsBodyAndParams(
      getUnitTestStatusHandler,
      undefined,
      UnitTestStatusQuerySchema,
      UnitTestStatusResponseSchema
    ),
  });
}

export default Routes;
