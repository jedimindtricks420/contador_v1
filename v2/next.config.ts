import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/v2",
  assetPrefix: "/v2",
  // Хост со общей RAM на ~30 контейнеров разных проектов, без swap. Параллельная
  // сборка (по умолчанию — воркер на каждое ядро, здесь 4) кратно умножает пик
  // памяти сборки и уже один раз уронила всю VM (19.08.2026). cpus:1 — один
  // воркер, сборка медленнее, зато пик памяти предсказуем и не растёт с числом ядер.
  experimental: {
    cpus: 1,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
