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
  GITHUB_DEFAULT_BRANCH: string;
  GITHUB_TEMPLATE_REPO: string;
  GITHUB_TEMPLATE_OWNER: string;
}

export const additionalEnvironmentVariables: AdditionalConfig[] = [
  { name: 'GITHUB_TOKEN', type: 'string' },
  { name: 'GITHUB_DEFAULT_BRANCH', type: 'string' },
  { name: 'GITHUB_TEMPLATE_REPO', type: 'string' },
  { name: 'GITHUB_TEMPLATE_OWNER', type: 'string' },
];

export type Configuration = ProcessorConfig & ExtendedConfig;