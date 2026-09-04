/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/verify-payment': [
        './public/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
