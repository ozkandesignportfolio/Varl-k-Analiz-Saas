import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "node_modules/**",
      "testsprite/**",
      "playwright-report/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Use ServerEnv / PublicEnv / BuildEnv",
        },
      ],
    },
  },
  {
    files: ["src/lib/env/**/*.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["src/instrumentation.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
]);

export default eslintConfig;
