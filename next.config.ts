import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  serverExternalPackages: ["exceljs"],
  async redirects() {
    return [{ source: "/apps/:id", destination: "/numbers/:id", permanent: true }];
  },
};

export default nextConfig;
