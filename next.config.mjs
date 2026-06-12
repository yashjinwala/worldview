/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Single Node process; the per-turn SSE stream stays open while async generation
  // completes (TDD §2/§5). Nothing here forces serverless.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
