import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {},
  // The lib/handlers use NodeNext-style explicit `.js` import specifiers (so they
  // typecheck under NodeNext and run under Vitest). Teach the Next/webpack
  // resolver to map `.js` → `.ts(x)` so the production build resolves them too.
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return cfg;
  },
};

export default config;
