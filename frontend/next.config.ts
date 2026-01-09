import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Skip ESLint during production builds (Docker), so type/lint warnings don't fail the build
    ignoreDuringBuilds: true,
  },
  // Performance optimizations
  // Note: swcMinify is deprecated in Next.js 15 - SWC minification is enabled by default
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Reduce bundle size
  experimental: {
    optimizePackageImports: ['antd', 'chart.js', 'react-chartjs-2'],
  },
  // Disable source maps in production for better performance
  productionBrowserSourceMaps: false,
  // Enable standalone output for Docker (reduces image size and improves performance)
  output: 'standalone',
};

export default nextConfig;
