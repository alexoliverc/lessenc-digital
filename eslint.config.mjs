import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    extends: [js.configs.recommended],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
    },
  },
  {
    files: [
      "src/shared/**/*.ts",
      "src/modules/*/domain/**/*.ts",
      "src/modules/*/application/**/*.ts",
    ],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "next",
                "next/*",
                "@prisma/*",
                "*generated/prisma*",
                "**/generated/**",
                "**/infrastructure/**",
                "mercadopago",
                "mercadopago/*",
                "node:*",
              ],
              message: "Domain/Application must use provider-independent contracts.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "fetch",
        "Request",
        "Response",
        "XMLHttpRequest",
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/prisma/**",
  ]),
]);
