/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run separately; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
  images: {
    // Roblox avatar/thumbnail CDNs used for logged-in user pictures.
    remotePatterns: [
      { protocol: "https", hostname: "tr.rbxcdn.com" },
      { protocol: "https", hostname: "**.rbxcdn.com" },
    ],
  },
  experimental: {
    // sharp is a native module: it loads a platform-specific .node binary at runtime.
    // Webpack cannot bundle that - it would either inline the JS and lose the binary, or
    // fail the build outright - so it is left as a real require() out of node_modules.
    //
    // It is used by the merch plate cutter (lib/merch/plate.ts), which is the only
    // reason a clothing template can be served as eighteen separate shredded faces
    // instead of as one stealable PNG.
    serverComponentsExternalPackages: ["sharp"],
  },
};

export default nextConfig;
