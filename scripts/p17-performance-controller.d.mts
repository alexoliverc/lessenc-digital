export interface PerformanceControllerOperations {
  waitForDatabase(): Promise<unknown>;
  runCommand(executable: string, args: string[]): Promise<unknown>;
  startCalibration(): Promise<unknown>;
  verifyCalibration(): Promise<unknown>;
  startApplication(): unknown;
  waitForApplication(): Promise<unknown>;
  stopApplication(application: unknown): Promise<unknown>;
  stopCalibration(): Promise<unknown>;
}

export function selectPerformancePlaywrightArgs(scope?: string): string[];

export function executePerformanceControllerPlan(
  operations: PerformanceControllerOperations,
  scope?: string,
): Promise<void>;

export function runLocalPerformanceAcceptance(scope?: string): Promise<void>;

export const PERFORMANCE_CONTROLLER_PLAN: Readonly<Record<string, string>>;
