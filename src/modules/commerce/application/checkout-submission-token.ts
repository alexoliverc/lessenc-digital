export type CheckoutSubmissionTokenValue = Readonly<{
  submissionId: string;
  issuedAt: string;
  presentedAmountMinor: number;
  presentedCurrency: "BRL";
}>;

export type CheckoutSubmissionTokenIssueError =
  | "INVALID_SECRET"
  | "INVALID_SUBMISSION_ID"
  | "INVALID_ISSUED_AT"
  | "INVALID_PRESENTED_AMOUNT"
  | "INVALID_PRESENTED_CURRENCY";

export type CheckoutSubmissionTokenVerifyError =
  | "INVALID_SECRET"
  | "MALFORMED_TOKEN"
  | "INVALID_SIGNATURE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_PAYLOAD";

export type CheckoutSubmissionTokenIssueResult =
  | Readonly<{
      ok: true;
      token: string;
    }>
  | Readonly<{
      ok: false;
      reason: CheckoutSubmissionTokenIssueError;
    }>;

export type CheckoutSubmissionTokenVerifyResult =
  | Readonly<{
      ok: true;
      value: CheckoutSubmissionTokenValue;
    }>
  | Readonly<{
      ok: false;
      reason: CheckoutSubmissionTokenVerifyError;
    }>;

export interface CheckoutSubmissionTokenService {
  issue(
    input: Readonly<{
      submissionId: string;
      issuedAt: string;
      presentedAmountMinor: number;
      presentedCurrency: string;
    }>,
  ): CheckoutSubmissionTokenIssueResult;

  verify(token: string): CheckoutSubmissionTokenVerifyResult;
}
