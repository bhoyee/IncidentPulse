/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  eslint: {
    dirs: ["app", "components", "lib", "hooks"]
  }
};

module.exports = nextConfig;

