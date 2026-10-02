import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  outputFileTracingIncludes: { "/api/**": ["./node_modules/.prisma/client/**/*"] },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
