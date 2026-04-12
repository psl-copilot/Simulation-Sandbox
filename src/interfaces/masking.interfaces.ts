// SPDX-License-Identifier: Apache-2.0

export enum MaskingMethod {
  REDACT = 'REDACT',
  TOKENIZE = 'TOKENIZE',
  HASH = 'HASH',
  PARTIAL_MASK = 'PARTIAL_MASK',
  GENERALIZE = 'GENERALIZE',
}

export interface FieldMask {
  fieldPath: string;
  maskingMethod: MaskingMethod;
}

export interface MaskingConfiguration {
  txtp: string;
  version: string;
  fieldMasks: FieldMask[];
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionLog {
  txtp: string;
  version: string;
  timestamp: string;
  recordCount: number;
  status: 'success' | 'error';
  message?: string;
}

export interface TransactionRecord {
  [key: string]: unknown;
}

export interface TransactionDataFile {
  txtp: string;
  version: string;
  records: TransactionRecord[];
}
