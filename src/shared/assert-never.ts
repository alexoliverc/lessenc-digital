export function assertNever(value: never): never {
  // Do not interpolate unknown runtime input into diagnostics.
  void value;
  throw new Error("Unexpected internal discriminant");
}
