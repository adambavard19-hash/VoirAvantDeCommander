import { execSync } from "node:child_process";

/**
 * Applique les migrations sur la base de test (opération non destructive).
 * Chaque test crée ses propres restaurants : aucune remise à zéro n'est nécessaire.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://vadc:vadc_dev_password@localhost:5432/vadc_test";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
