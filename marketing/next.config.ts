import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Весь manifest (urlFor в lib/manifest.ts) генерирует канонические URL,
  // hreflang, sitemap и внутренние ссылки ТОЛЬКО с завершающим слэшем
  // ("/ru/vozmozhnosti/..."), как того требует TASK-0003 §4. По умолчанию
  // Next.js отдаёт trailingSlash:false и 308-редиректит "/ru/" → "/ru", где
  // маршрут не резолвится (страница зарегистрирована в generateStaticParams
  // с сегментами вида "vozmozhnosti/zakrytie-mesyaca", т.е. без хвостового
  // слэша, но URL-схема приложения ожидает слэш) — без этой опции реальный
  // HTTP-запрос почти к любому из 60 URL получал 308 → 404. Обнаружено прямой
  // curl-проверкой запущенного контейнера (2026-09-09), не покрывалось
  // модульными тестами на renderToStaticMarkup.
  trailingSlash: true,
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
