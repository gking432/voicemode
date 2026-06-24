import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are consumed from TypeScript source.
  transpilePackages: [
    "@vco/shared",
    "@vco/db",
    "@vco/project-adapters",
    "@vco/agents",
    "@vco/orchestrator",
  ],
  // Keep native/heavy deps out of the server bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client", "bullmq", "ioredis"],
};

export default nextConfig;
