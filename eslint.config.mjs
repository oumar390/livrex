import next from "eslint-config-next/core-web-vitals";
import { globalIgnores } from "eslint/config";
const config = [
  ...next,
  globalIgnores([
    ".next/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
];

export default config;
