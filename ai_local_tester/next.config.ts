import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['100.92.238.83', 'localhost:3000', 'localhost:3001', 'localhost:3002'],
  experimental: {
    // Other experimental options if needed
  },
};

export default nextConfig;
