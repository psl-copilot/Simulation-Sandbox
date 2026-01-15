import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from '../config';
import type { BootstrapBody } from '../interfaces/github.interfaces';
import { GitHubService } from '../services/github.service';

export const bootstrapRoutes = (config: Configuration, logger: LoggerService) => {
  const githubService = new GitHubService(config, logger);

  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: BootstrapBody }>(
      '/bootstrap',
      {
        schema: {
          body: {
            type: 'object',
            required: ['ruleId', 'ruleVersion', 'organization'],
            properties: {
              ruleId: { type: 'string' },
              ruleVersion: { type: 'string' },
              organization: { type: 'string' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                repoUrl: { type: 'string' },
                message: { type: 'string' },
              },
            },
            500: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Body: BootstrapBody }>, reply: FastifyReply) => {
        const { ruleId, ruleVersion, organization } = request.body;

        const result = await githubService.bootstrap(ruleId, ruleVersion, organization);

        if (result.success) {
          return reply.status(200).send(result);
        }
        return reply.status(500).send(result);
      }
    );
  };
};
