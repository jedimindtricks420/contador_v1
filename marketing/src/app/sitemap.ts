import type { MetadataRoute } from "next";
import { getPublishedTopics, urlFor, localeUrlPair, LOCALES } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";

// Только опубликованные темы из manifest — TASK-0003 §8: "Sitemap не должен
// содержать login/register/кабинет/API/draft". Здесь просто нет других
// источников URL, кроме published-записей seo-pages.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const topic of getPublishedTopics()) {
    const pair = localeUrlPair(topic);
    for (const locale of LOCALES) {
      entries.push({
        url: absoluteUrl(urlFor(topic, locale)),
        lastModified: topic.updatedAt,
        alternates: {
          languages: {
            "ru-UZ": absoluteUrl(pair.ru),
            "uz-UZ": absoluteUrl(pair.uz),
          },
        },
      });
    }
  }
  return entries;
}
