
import { Type, type Static } from '@sinclair/typebox';

export type FetchLatestTestReportBody = Static<typeof FetchLatestTestReportBodySchema>;
export const FetchLatestTestReportBodySchema = Type.Object({
  organization: Type.String(),
  ruleId: Type.String(),
  branchName: Type.String(),
});


export type FetchLatestTestReportResponse = Static<typeof FetchLatestTestReportResponseSchema>;
export const FetchLatestTestReportResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  reportHtml: Type.Optional(Type.String()),
});

