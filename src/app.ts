import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config';
import { additionalEnvironmentVariables, type Configuration } from './config';


class App {

  private readonly logger: LoggerService;
  private readonly config: Configuration;

  constructor() {
    this.config = validateProcessorConfig(
      additionalEnvironmentVariables
    ) as Configuration;
    this.logger = new LoggerService(this.config);

    this.logger.log('Hello World');
  }

}

new App();