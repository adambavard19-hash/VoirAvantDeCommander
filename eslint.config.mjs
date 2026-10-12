import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "storage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      // Les contenus utilisateurs (photos des plats) sont servis en variantes WebP
      // pré-calculées avec srcset : next/image n'apporte rien ici.
      "@next/next/no-img-element": "off",
    },
  },
]);
