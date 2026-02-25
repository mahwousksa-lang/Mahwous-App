/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '50mb',
  },
  images: {
    domains: ['*'],
    unoptimized: true,
  },
  experimental: {
    serverActions: false,
  },
};

module.exports = nextConfig;
