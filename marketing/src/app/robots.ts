import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

// Разрешаем публичные маркетинговые страницы, явно закрываем то, что не
// относится к этому приложению (кабинет и API живут в другом приложении
// на том же домене — /v2 и /admin — на случай единого robots.txt хоста).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/v2/", "/admin/", "/api/"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
