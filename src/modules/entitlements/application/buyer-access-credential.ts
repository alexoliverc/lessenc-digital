export type BuyerAccessCredentialMaterial = Readonly<{
  rawCredential: string;
  secretHash: string;
}>;

export type BuyerAccessCredentialHashResult =
  | Readonly<{
      ok: true;
      secretHash: string;
    }>
  | Readonly<{
      ok: false;
      reason: "MALFORMED_CREDENTIAL";
    }>;

export interface BuyerAccessCredentialSecretService {
  issue(): BuyerAccessCredentialMaterial;

  hash(rawCredential: unknown): BuyerAccessCredentialHashResult;
}
