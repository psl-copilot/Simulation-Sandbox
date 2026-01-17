import { Type, type Static } from '@sinclair/typebox';

export type PopulateBody = Static<typeof PopulateBodySchema>;
export const PopulateBodySchema = Type.Object({
  organization: Type.String(),
  ruleId: Type.String(),
  ruleCode: Type.String(),
  testCode: Type.String(),
});

export type PopulateResponse = Static<typeof PopulateResponseSchema>;
export const PopulateResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});
