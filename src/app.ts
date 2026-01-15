import Fastify from 'fastify';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config';
import { additionalEnvironmentVariables, type Configuration } from './config';
import { bootstrapRoutes } from './routes/bootstrap.routes';

class App {
  private readonly logger: LoggerService;
  private readonly config: Configuration;
  private readonly server = Fastify({ logger: false });

  constructor() {
    this.config = validateProcessorConfig(additionalEnvironmentVariables) as Configuration;
    this.logger = new LoggerService(this.config);
    this.start();
  }

  private async start(): Promise<void> {
    this.server.get('/health', async () => ({ status: 'ok' }));
    await this.server.register(bootstrapRoutes(this.config, this.logger), { prefix: '/api/v1' });

    const host = process.env.HOST || '0.0.0.0';
    const port = Number(process.env.PORT) || 3000;

    await this.server.listen({ host, port });
    this.logger.log(`Server: http://${host}:${port}`);
  }
}

new App();