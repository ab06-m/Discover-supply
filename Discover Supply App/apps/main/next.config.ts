import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Tree-shake barrel exports from large icon/UI libraries
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  // Compress responses for faster transfer
  compress: true,
  // Generate ETags for client caching
  generateEtags: true,
  // Reduce powered-by header overhead
  poweredByHeader: false,
};

export default nextConfig;
