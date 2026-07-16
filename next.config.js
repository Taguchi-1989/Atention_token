const isDevelopment = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The production bundle is served by FastAPI. During `next dev`, proxy API
  // requests so the documented two-process setup works without extra CORS or
  // environment configuration.
  ...(isDevelopment
    ? {
        async rewrites() {
          const apiTarget = process.env.ATTENTION_LEDGER_API_URL || 'http://127.0.0.1:8000';
          return [
            {
              source: '/api/:path*',
              destination: `${apiTarget}/api/:path*`,
            },
          ];
        },
      }
    : { output: 'export' }),
  // Static export outputs to 'out/' directory.
  // Served by FastAPI's StaticFiles mount (basePath empty),
  // or by GitHub Pages under /<repo-name> (set BASE_PATH at build time).
  basePath: process.env.BASE_PATH || '',
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || '',
  },
};

module.exports = nextConfig;
