/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "*.cjs" {
  const value: any
  export = value
}

declare module "../../../scripts/load-test-env.cjs" {
  export function loadTestEnv(): void
  export function validateRequiredSuiteEnv(suite: string): void
}
