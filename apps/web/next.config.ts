import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The contracts package ships its generated ABI as TypeScript source.
  transpilePackages: ["@location-checkin/contracts"],
};

export default nextConfig;
