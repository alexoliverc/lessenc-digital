import type { NextConfig } from "next";

import { securityHeaderRules } from "./src/lib/security/http-security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Next.js materializes these rules into the build artifact.
    // APP_ENV must therefore have its canonical value while `next build` runs.
    return securityHeaderRules();
  },
};

export default nextConfig;
