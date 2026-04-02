import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
      },
      {
        protocol: 'https',
        hostname: '*.psacard.com',
      },
      {
        protocol: 'https',
        hostname: '*.cgccards.com',
      },
      {
        protocol: 'https',
        hostname: '*.beckett.com',
      },
      {
        protocol: 'https',
        hostname: '*.ebayimg.com',
      },
    ],
    unoptimized: true, // Allow any external image without next/image optimization
  },
};

export default nextConfig;
