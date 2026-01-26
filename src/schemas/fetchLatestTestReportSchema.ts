import { Type, type Static } from '@sinclair/typebox';

export type FetchLatestTestReportQuery = Static<typeof FetchLatestTestReportQuerySchema>;
export const FetchLatestTestReportQuerySchema = Type.Object({
  organization: Type.String(),
  ruleId: Type.String(),
  branchName: Type.Optional(Type.String()),
});

export type FetchLatestTestReportResponse = Static<typeof FetchLatestTestReportResponseSchema>;
export const FetchLatestTestReportResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  reportHtml: Type.Optional(Type.String()),
});
