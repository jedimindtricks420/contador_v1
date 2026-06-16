import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/v2",
  assetPrefix: "/v2",
  turbopack: {
    root: "/home/admin1/contador/v2",
  },
};

export default nextConfig;
