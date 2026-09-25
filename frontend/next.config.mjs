/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run `node server.js` with a minimal node_modules footprint.
  // Harmless for `next dev` / `next start`; only affects the build output.
  output: "standalone",
};

export default nextConfig;
