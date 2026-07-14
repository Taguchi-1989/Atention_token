/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Static export outputs to 'out/' directory.
  // Served by FastAPI's StaticFiles mount (basePath empty),
  // or by GitHub Pages under /<repo-name> (set BASE_PATH at build time).
  basePath: process.env.BASE_PATH || '',
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || '',
  },
};

module.exports = nextConfig;
