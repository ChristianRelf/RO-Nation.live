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
};

export default nextConfig;
