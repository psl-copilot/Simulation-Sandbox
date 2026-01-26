// SPDX-License-Identifier: Apache-2.0
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  type AdditionalConfig,
  type ProcessorConfig,
  validateProcessorConfig,
} from '@tazama-lf/frms-coe-lib/lib/config/processor.config';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export type Configuration = ProcessorConfig & IConfig;

export interface IConfig {
  GITHUB_DEFAULT_BRANCH: string;
  GITHUB_TEMPLATE_REPO: string;
  GITHUB_TEMPLATE_OWNER: string;
  GITHUB_TEST_REPORT_PATH: string;
  PORT: number;
}

export const additionalEnvironmentVariables: AdditionalConfig[] = [
  {
    name: 'GITHUB_DEFAULT_BRANCH',
    type: 'string',
    optional: false,
  },
  {
    name: 'GITHUB_TEMPLATE_OWNER',
    type: 'string',
    optional: false,
  },
  {
    name: 'GITHUB_TEMPLATE_REPO',
    type: 'string',
    optional: false,
  },
  {
    name: 'GITHUB_TEST_REPORT_PATH',
    type: 'string',
    optional: false,
  },
  {
    name: 'PORT',
    type: 'number',
    optional: false,
  },
];

const processorConfig = validateProcessorConfig(additionalEnvironmentVariables) as Configuration;

export { processorConfig };
