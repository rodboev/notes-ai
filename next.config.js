/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
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
    if (isServer) {
      config.externals.push('ws')
    }
    return config
  },
  serverExternalPackages: ['mssql'],
  env: {
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
  },
}

export default nextConfig
