import "server-only";

import { z } from "zod";

/**
 * PURE SCHEMA LAYER.
 *
 * Bu dosyada tek sorumluluk: backend env schema'sını tanımlamak ve `process.env`'i
 * tek noktada parse etmek.  SINGLETON YAŞAMI burada DEĞİL, `runtime-env.ts`'de
 * tutulur. Böylece:
 *  - Bu modül sıfır durum içerir (stateless, saf).
 *  - Testlerde schema doğrudan kullanılabilir; cache karışıklığı olmaz.
 *  - Tüm tüketiciler `runtime-env`'in `getConfig()` / `CONFIG` API'sini kullanır.
 */

const nonEmpty = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} must not be empty`);

const httpsUrl = (name: string) =>
  nonEmpty(name).refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: `${name} must be a valid http(s) URL` },
  );

const stripeSecret = z
  .string({ error: "STRIPE_SECRET_KEY is required" })
  .trim()
  .refine(
    (value) => value.startsWith("sk_test_") || value.startsWith("sk_live_"),
    { message: "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_" },
  );

const booleanFlag = z
  .string()
  .optional()
  .transform((value) => value?.trim().toLowerCase() === "true");

export const serverEnvSchema = z.object({
  // --- Kritik kimlik/kaynak anahtarları ---
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty("SUPABASE_SERVICE_ROLE_KEY"),
  NEXT_PUBLIC_SUPABASE_URL: httpsUrl("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  STRIPE_SECRET_KEY: stripeSecret,
  TURNSTILE_SECRET_KEY: nonEmpty("TURNSTILE_SECRET_KEY"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: nonEmpty("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),

  // --- Operasyonel flag'lar (services bunları CONFIG'den okur) ---
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  STRIPE_ALLOW_LIVE_IN_NON_PROD: booleanFlag,
});

export type ServerEnv = Readonly<z.infer<typeof serverEnvSchema>>;

const readRawEnv = () => ({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NODE_ENV: process.env.NODE_ENV,
  STRIPE_ALLOW_LIVE_IN_NON_PROD: process.env.STRIPE_ALLOW_LIVE_IN_NON_PROD,
});

export type ParseServerEnvResult =
  | { ok: true; data: ServerEnv }
  | { ok: false; issues: string[] };

const formatIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const key = issue.path[0] ?? "env";
    return `${String(key)}: ${issue.message}`;
  });

/**
 * `process.env`'i bir kez parse eder. Saftır; state tutmaz. Runtime singleton
 * `runtime-env.ts` tarafından cache'lenir.
 */
export const parseServerEnv = (): ParseServerEnvResult => {
  const result = serverEnvSchema.safeParse(readRawEnv());
  if (result.success) {
    return { ok: true, data: Object.freeze(result.data) as ServerEnv };
  }
  return { ok: false, issues: formatIssues(result.error) };
};
