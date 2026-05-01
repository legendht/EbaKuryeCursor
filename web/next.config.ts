import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '76.13.141.249:3000',
        'ebakurye.com',
        'www.ebakurye.com',
      ],
    },
  },
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
