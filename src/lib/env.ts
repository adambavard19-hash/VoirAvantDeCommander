import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_SECRET: z.string().min(32, "APP_SECRET doit contenir au moins 32 caractères"),
  DATABASE_URL: z.string().min(1),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  DEEPL_API_KEY: z.string().optional(),

  CONTACT_EMAIL: z.string().optional(),
  CONTACT_PHONE: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Variables d'environnement validées. Lève une erreur explicite si la configuration est invalide. */
export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  // Sur Vercel, l'adresse de production est connue : APP_URL devient facultatif.
  if (!raw.APP_URL && raw.VERCEL_PROJECT_PRODUCTION_URL) raw.APP_URL = `https://${raw.VERCEL_PROJECT_PRODUCTION_URL}`;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration invalide :\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** URL publique de base, sans barre oblique finale. */
export function appUrl(): string {
  return env().APP_URL.replace(/\/+$/, "");
}
