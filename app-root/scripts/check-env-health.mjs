#!/usr/bin/env node
/**
 * check-env-health.mjs
 *
 * Verifies that .env.local exists and contains all required env vars.
 * Run: node scripts/check-env-health.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Required env vars (will throw at runtime if missing) ──
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
];

// ── Functionally required (optional in schema, but needed for features) ──
const FUNCTIONAL = [
  "STRIPE_PRICE_PREMIUM",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
];

// ── Optional but recommended ──
const OPTIONAL = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "AUTOMATION_CRON_SECRET",
  "CRON_SECRET",
  "DATABASE_URL",
  "ADMIN_DASHBOARD_SECRET",
];

const envLocalPath = resolve(ROOT, ".env.local");

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║           Assetly — Environment Health Check            ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

// ── Step 1: File existence ──
const envFiles = [".env.local", ".env", ".env.development", ".env.production"];
console.log("📁 File System Check:");
for (const f of envFiles) {
  const p = resolve(ROOT, f);
  const exists = existsSync(p);
  const icon = exists ? "✅" : "❌";
  if (exists) {
    const stat = readFileSync(p, "utf8");
    const lines = stat.split("\n").filter((l) => l.match(/^[A-Z]/)).length;
    console.log(`  ${icon} ${f}  (${lines} env vars, ${stat.length} bytes)`);
  } else {
    console.log(`  ${icon} ${f}  (not found)`);
  }
}

// ── Step 2: Parse .env.local ──
console.log("");
if (!existsSync(envLocalPath)) {
  console.error("🚨 CRITICAL: .env.local does not exist! Create it from .env.example.\n");
  process.exit(1);
}

const raw = readFileSync(envLocalPath, "utf8");
const envMap = new Map();
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.substring(0, eqIdx).trim();
  const val = trimmed.substring(eqIdx + 1).trim();
  envMap.set(key, val);
}

// ── Step 3: Vercel CLI overwrite detection ──
if (raw.includes("Created by Vercel CLI") || (envMap.size <= 2 && envMap.has("VERCEL_OIDC_TOKEN"))) {
  console.error("🚨 WARNING: .env.local appears to have been overwritten by `vercel env pull`!");
  console.error("   It only contains Vercel system vars. Restore your real env vars.\n");
}

// ── Step 4: Check required vars ──
let hasErrors = false;

const checkGroup = (label, keys, isCritical) => {
  console.log(`${isCritical ? "🔴" : "🟡"} ${label}:`);
  for (const key of keys) {
    const val = envMap.get(key) || "";
    const isEmpty = !val || val === '""' || val === "''";
    const isPlaceholder =
      val.includes("YOUR_") ||
      val.includes("your_") ||
      val.includes("xxx") ||
      val === "change_me" ||
      val === "change_me_email_reminder";

    if (isEmpty) {
      console.log(`  ❌ ${key} — EMPTY`);
      if (isCritical) hasErrors = true;
    } else if (isPlaceholder) {
      console.log(`  ⚠️  ${key} — PLACEHOLDER (needs real value)`);
      if (isCritical) hasErrors = true;
    } else {
      const preview = val.length > 12 ? val.substring(0, 8) + "****" : "****";
      console.log(`  ✅ ${key} — SET (${preview})`);
    }
  }
  console.log("");
};

checkGroup("Required (server crashes without these)", REQUIRED, true);
checkGroup("Functional (features break without these)", FUNCTIONAL, false);
checkGroup("Optional (gracefully disabled if missing)", OPTIONAL, false);

// ── Step 5: Stripe key sanity ──
const stripeKey = envMap.get("STRIPE_SECRET_KEY") || "";
if (stripeKey && !stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("sk_live_")) {
  console.error('🚨 STRIPE_SECRET_KEY must start with "sk_test_" or "sk_live_"\n');
  hasErrors = true;
}

const priceId = envMap.get("STRIPE_PRICE_PREMIUM") || "";
if (priceId && !priceId.startsWith("price_")) {
  console.error('🚨 STRIPE_PRICE_PREMIUM must start with "price_"\n');
  hasErrors = true;
}

const supaUrl = envMap.get("NEXT_PUBLIC_SUPABASE_URL") || "";
if (supaUrl && !supaUrl.startsWith("https://")) {
  console.error('🚨 NEXT_PUBLIC_SUPABASE_URL must start with "https://"\n');
  hasErrors = true;
}

// ── Summary ──
console.log("═══════════════════════════════════════════════════════════");
if (hasErrors) {
  console.error("❌ FAIL — Required env vars are missing or have placeholder values.");
  console.error("   Fill in real values from your Supabase/Stripe dashboards, then restart next dev.\n");
  process.exit(1);
} else {
  console.log("✅ PASS — All required env vars appear to be set.");
  console.log("   Run `npm run dev` to start the dev server.\n");
  process.exit(0);
}
