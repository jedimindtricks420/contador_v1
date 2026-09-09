// Единый источник origin для абсолютных URL (canonical, hreflang, OG, sitemap).
// Продовый хост подтверждён в задаче TASK-0003 (contador.uz), но фактический
// canonical-host определяется владельцем при выпуске — поэтому origin читается
// из окружения с этим значением как fallback, а не зашивается в каждый файл.
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") || "https://contador.uz";

// Абсолютный путь в кабинет v2 (basePath "/v2" на том же домене). CTA ведут
// сюда, а не в маркетинговое приложение — оно не содержит авторизации/сессий.
export const APP_LOGIN_URL = "/v2/login";
export const APP_REGISTER_URL = "/v2/register";

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
