// 屏蔽 Node 24+ 的 DEP0060 警告 (util._extend，来自内部依赖，无法从源头修复)
const _origWarn = process.emitWarning
process.emitWarning = function (warning, ...args) {
  if (args[0] === "DeprecationWarning" && args[1] === "DEP0060") return
  if (typeof warning === "object" && warning?.code === "DEP0060") return
  return _origWarn.call(this, warning, ...args)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 开发模式: 将 /api/* 和 /uploads/* 代理到 Spring Boot 后端
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8082"
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ]
  },
}

export default nextConfig
