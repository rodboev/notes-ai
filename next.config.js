/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    reactCompiler: true,
  },
  serverExternalPackages: ['mssql'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }
    return config
  },
  env: {
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
  },
  trailingSlash: true,
}

export default nextConfig
