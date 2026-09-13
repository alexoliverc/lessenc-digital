export type CheckoutActionState =
  | Readonly<{
      state: "IDLE";
      message: null;
      emailError: null;
    }>
  | Readonly<{
      state: "VALIDATION_ERROR";
      message: string;
      emailError: string;
    }>
  | Readonly<{
      state: "CREATED";
      message: string;
      emailError: null;
    }>
  | Readonly<{
      state: "EXISTING";
      message: string;
      emailError: null;
    }>
  | Readonly<{
      state: "UNAVAILABLE";
      message: string;
      emailError: null;
    }>
  | Readonly<{
      state: "FAILED";
      message: string;
      emailError: null;
    }>;

export const initialCheckoutActionState: CheckoutActionState = Object.freeze({
  state: "IDLE",
  message: null,
  emailError: null,
});
