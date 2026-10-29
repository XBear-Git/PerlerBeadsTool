import { hostname, networkInterfaces } from "node:os";

import type { NextConfig } from "next";

/**
 * Next.js 开发服务器默认只信任 localhost。
 * 从终端点击 127.0.0.1 / 局域网 IP 打开页面时，HMR 与 dev 资源会被判为
 * 跨域并阻断，导致页面能显示但客户端没有完成水合，所有按钮都不可交互。
 * 这里自动收集本机 IPv4 地址，避免每次换网络/换机器都要手动改配置。
 */
const localDevOrigins = [
  "localhost",
  "127.0.0.1",
  "::1",
  hostname(),
  ...Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [...new Set(localDevOrigins)],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
