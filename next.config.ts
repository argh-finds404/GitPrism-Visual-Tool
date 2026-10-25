import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // MergeLab's type check reads TypeScript's standard library declarations at runtime.
  outputFileTracingIncludes: {
    "/api/repos/*/*/merge-check": ["./node_modules/typescript/lib/lib.*.d.ts"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
