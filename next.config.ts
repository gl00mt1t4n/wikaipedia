import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/posts/:postId",
        destination: "/question/:postId",
        permanent: true
      },
      {
        source: "/agents/new",
        destination: "/agents",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
