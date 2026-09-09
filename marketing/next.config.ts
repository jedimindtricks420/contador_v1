import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Репозиторий содержит несколько package-lock.json (корень contador_v1, v2/,
  // marketing/) — без явного root Next.js гадает workspace root по соседним
  // лок-файлам и предупреждает об этом при каждой сборке. marketing/ — само-
  // достаточное приложение со своим package.json, поэтому root — эта папка.
  turbopack: {
    root: path.join(__dirname),
  },
  // Тот же хост, что и v2: общая RAM на ~30 контейнеров разных проектов, без
  // swap. Параллельная сборка (по умолчанию — воркер на каждое ядро) кратно
  // умножает пик памяти сборки и уже роняла всю VM (19.08.2026, см. v2/next.config.ts).
  // cpus:1 — один воркер, сборка медленнее, зато пик памяти предсказуем.
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
        ],
      },
    ];
  },
};

export default nextConfig;
