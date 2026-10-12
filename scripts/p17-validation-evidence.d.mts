export interface ValidationEvidenceInput {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly repositoryRoot: string;
  readonly environment?: NodeJS.ProcessEnv;
}

export function sanitizeValidationOutput(
  value: unknown,
  repositoryRoot: string,
  sensitiveValues?: readonly string[],
): string;
export function sanitizeValidationCommand(
  command: string,
  args: readonly string[],
): readonly string[];
export function collectValidationEvidence(
  input: ValidationEvidenceInput,
): Readonly<Record<string, unknown>>;
