import type {
  AdditionalConfig,
  ProcessorConfig,
} from '@tazama-lf/frms-coe-lib/lib/config/processor.config';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export interface ExtendedConfig {
  GITHUB_TOKEN: string;
}

export const additionalEnvironmentVariables: AdditionalConfig[] = [
  { name: 'GITHUB_TOKEN', type: 'string' },
];

export type Configuration = ProcessorConfig & ExtendedConfig;