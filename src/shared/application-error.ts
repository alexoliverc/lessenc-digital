const messages = {
  INVALID_MONEY: "Invalid monetary amount",
  UNSUPPORTED_CURRENCY: "Unsupported currency",
  CURRENCY_MISMATCH: "Incompatible currencies",
  INVALID_QUANTITY: "Invalid purchase quantity",
  PRODUCT_UNAVAILABLE: "Product is not available for purchase",
  OFFER_UNAVAILABLE: "Offer is not available for purchase",
  OFFER_PRODUCT_MISMATCH: "Offer does not belong to the selected product",
  INVALID_SNAPSHOT: "Invalid order snapshot",
  INCONSISTENT_TOTAL: "Order totals are inconsistent",
  INVALID_ORDER_TRANSITION: "Order transition is not permitted",
  INVALID_PAYMENT_TRANSITION: "Payment transition is not permitted",
  INVALID_ENTITLEMENT_TRANSITION: "Entitlement transition is not permitted",
  INVALID_FINANCIAL_ORIGIN: "Financial evidence is incompatible with the operation",
  DUPLICATE_ENTITLEMENT: "An entitlement already exists for this item",
  PERSISTENCE_UNAVAILABLE: "Catalog data is temporarily unavailable",
} as const;

export type ApplicationErrorCode = keyof typeof messages;

// Context is deliberately closed: never accept arbitrary payloads, IDs, SQL or causes.
export class ApplicationError extends Error {
  readonly context: Readonly<{ operation: "business-rule" | "catalog-read" }>;

  constructor(
    readonly code: ApplicationErrorCode,
    operation: "business-rule" | "catalog-read" = "business-rule",
  ) {
    super(messages[code]);
    this.name = "ApplicationError";
    this.context = Object.freeze({ operation });
  }

  toJSON() {
    return { code: this.code, message: this.message, context: this.context };
  }
}
