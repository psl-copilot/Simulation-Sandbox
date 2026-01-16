import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from './config';
import { GitHubService } from './services/github.logic.service';
import { SetOptionsBodyAndParams } from './utils/schema-utils';
import {
    BootstrapBodySchema,
    BootstrapResponseSchema,
    PopulateBodySchema,
    PopulateResponseSchema,
    type BootstrapBody,
    type PopulateBody,
} from './schemas';

export const createRouter = (config: Configuration, logger: LoggerService) => {
    const githubService = new GitHubService(config, logger);

    const handleHealthCheck = async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({ status: 'ok' });
    };

    const bootstrapHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        const { ruleId, ruleVersion, organization } = request.body as BootstrapBody;
        const result = await githubService.bootstrap(ruleId, ruleVersion, organization);
        return reply.status(result.success ? 200 : 500).send(result);
    };

    const populateHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        const { organization, ruleId, ruleCode, testCode } = request.body as PopulateBody;
        const result = await githubService.populate(organization, ruleId, ruleCode, testCode);
        return reply.status(result.success ? 200 : 500).send(result);
    };

    return async (fastify: FastifyInstance): Promise<void> => {
        fastify.get('/', handleHealthCheck);
        fastify.get('/health', handleHealthCheck);

        fastify.post('/v1/bootstrap', {
            ...SetOptionsBodyAndParams(bootstrapHandler, BootstrapBodySchema, BootstrapResponseSchema),
        });

        fastify.post('/v1/populate', {
            ...SetOptionsBodyAndParams(populateHandler, PopulateBodySchema, PopulateResponseSchema),
        });
    };
};
