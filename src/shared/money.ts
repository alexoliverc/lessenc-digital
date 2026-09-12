import { ApplicationError } from "./application-error";

export type Currency = "BRL";

export function parseCurrency(value: string): Currency {
  if (value !== "BRL") throw new ApplicationError("UNSUPPORTED_CURRENCY");
  return value;
}

export class Money {
  // Matches the existing P06 unsigned integer storage capacity; no schema expansion.
  static readonly maxMinor = 4_294_967_295;

  private constructor(
    readonly amountMinor: number,
    readonly currency: Currency,
  ) {
    Object.freeze(this);
  }

  static of(amountMinor: number, currency: string): Money {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > Money.maxMinor) {
      throw new ApplicationError("INVALID_MONEY");
    }
    return new Money(amountMinor, parseCurrency(currency));
  }

  requireCurrency(currency: string): void {
    if (this.currency !== currency) throw new ApplicationError("CURRENCY_MISMATCH");
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }

  add(other: Money): Money {
    this.requireCurrency(other.currency);
    return Money.of(this.amountMinor + other.amountMinor, this.currency);
  }

  multiply(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new ApplicationError("INVALID_QUANTITY");
    }
    return Money.of(this.amountMinor * quantity, this.currency);
  }
}
