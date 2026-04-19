/* eslint-disable @typescript-eslint/no-require-imports */
// Turnstile validation temporarily disabled for deployment fix
// const { validateTurnstileEnv } = require("./scripts/validate-turnstile-env.cjs");
// validateTurnstileEnv("next-config");

/** @type {import('next').NextConfig} */
module.exports = {
  // Tree-shake barrel-file packages; Next will transform root imports into
  // per-module imports at build time. Keeps `lucide-react` / Supabase /
  // `chart.js` from pulling their full entry points into the client bundle.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@supabase/ssr",
      "@supabase/supabase-js",
      "chart.js",
      "react-chartjs-2",
      "radix-ui",
    ],
  },
};
