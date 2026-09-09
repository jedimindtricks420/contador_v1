import { absoluteUrl, SITE_ORIGIN } from "@/lib/site";
import { getBreadcrumbChain, urlFor, type Locale, type Topic } from "@/lib/manifest";

// JSON-LD строится из тех же видимых данных, что и HTML — никаких
// рейтингов/отзывов/цены "0" (TASK-0003 §8). WebPage — на всех страницах,
// BreadcrumbList — на дочерних (когда есть хотя бы один уровень крошек),
// Organization/WebSite — только на главной.

export function webPageJsonLd(topic: Topic, locale: Locale) {
  const entry = topic.locales[locale];
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absoluteUrl(urlFor(topic, locale)),
    url: absoluteUrl(urlFor(topic, locale)),
    name: entry.title,
    description: entry.description,
    inLanguage: locale,
    isPartOf: {
      "@type": "WebSite",
      url: SITE_ORIGIN,
      name: "Contador",
    },
  };
}

export function breadcrumbJsonLd(topic: Topic, locale: Locale) {
  const chain = getBreadcrumbChain(topic, locale);
  if (chain.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: chain.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.href),
    })),
  };
}

export function organizationAndWebSiteJsonLd() {
  // Только подтверждённые поля — без ratings/reviews/offers и без
  // придуманных реквизитов (TASK-0003 §6, §8).
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}#organization`,
        name: "Contador",
        url: SITE_ORIGIN,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}#website`,
        url: SITE_ORIGIN,
        name: "Contador",
        publisher: { "@id": `${SITE_ORIGIN}#organization` },
      },
    ],
  };
}
