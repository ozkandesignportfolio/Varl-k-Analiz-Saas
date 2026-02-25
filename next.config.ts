import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ENABLE_ONBOARDING_SEED:
      process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_SEED ?? process.env.ENABLE_ONBOARDING_SEED ?? "false",
  },
};

export default nextConfig;
