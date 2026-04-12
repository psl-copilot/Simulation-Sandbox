// SPDX-License-Identifier: Apache-2.0

import { Type, type Static } from '@sinclair/typebox';

const MaskingMethodEnum = Type.Union([
  Type.Literal('REDACT'),
  Type.Literal('TOKENIZE'),
  Type.Literal('HASH'),
  Type.Literal('PARTIAL_MASK'),
  Type.Literal('GENERALIZE'),
]);

const FieldMaskSchema = Type.Object({
  fieldPath: Type.String(),
  maskingMethod: MaskingMethodEnum,
});

// POST /v1/sdl/configuration — save masking configuration
export type SaveConfigurationBody = Static<typeof SaveConfigurationBodySchema>;
export const SaveConfigurationBodySchema = Type.Object({
  txtp: Type.String(),
  version: Type.String(),
  fieldMasks: Type.Array(FieldMaskSchema),
  payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type SaveConfigurationResponse = Static<typeof SaveConfigurationResponseSchema>;
export const SaveConfigurationResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  overwritten: Type.Boolean(),
});

// POST /v1/sdl/mask-preview — preview a masked value
export type MaskPreviewBody = Static<typeof MaskPreviewBodySchema>;
export const MaskPreviewBodySchema = Type.Object({
  value: Type.String(),
  maskingMethod: MaskingMethodEnum,
});

export type MaskPreviewResponse = Static<typeof MaskPreviewResponseSchema>;
export const MaskPreviewResponseSchema = Type.Object({
  original: Type.String(),
  masked: Type.String(),
  maskingMethod: Type.String(),
});

// GET /v1/sdl/payload/:txtp/:version — read-only JSON payload viewer
export type PayloadViewerParams = Static<typeof PayloadViewerParamsSchema>;
export const PayloadViewerParamsSchema = Type.Object({
  txtp: Type.String(),
  version: Type.String(),
});

export type PayloadViewerResponse = Static<typeof PayloadViewerResponseSchema>;
export const PayloadViewerResponseSchema = Type.Object({
  txtp: Type.String(),
  version: Type.String(),
  payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  fieldMasks: Type.Array(FieldMaskSchema),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

// POST /v1/sdl/ingest — ingest transaction data file
export type IngestBody = Static<typeof IngestBodySchema>;
export const IngestBodySchema = Type.Object({
  txtp: Type.String(),
  version: Type.String(),
  records: Type.Array(Type.Record(Type.String(), Type.Unknown())),
});

export type IngestResponse = Static<typeof IngestResponseSchema>;
export const IngestResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  timestamp: Type.String(),
  recordCount: Type.Number(),
});
