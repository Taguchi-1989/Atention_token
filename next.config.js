/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Static export outputs to 'out/' directory
  // Served by FastAPI's StaticFiles mount
};

module.exports = nextConfig;
