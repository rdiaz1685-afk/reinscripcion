/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
  },
};

export default nextConfig;
