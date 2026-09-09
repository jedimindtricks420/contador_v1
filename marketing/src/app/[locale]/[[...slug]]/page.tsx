import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { Breadcrumbs } from "@/components/marketing/Breadcrumbs";
import { CONTENT_REGISTRY } from "@/content/registry";
import {
  LOCALES,
  findTopicBySlug,
  getPublishedTopics,
  localeUrlPair,
  slugSegments,
  urlFor,
  type Locale,
} from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbJsonLd, organizationAndWebSiteJsonLd, webPageJsonLd } from "@/lib/jsonld";

// Маршрут построен полностью из белого списка manifest (src/content/seo-pages.ts,
// только contentStatus === "published") — TASK-0003 §4/§8. dynamicParams=false
// означает: любая комбинация locale/slug, которой нет в generateStaticParams,
// сразу отдаёт настоящий 404 вместо попытки динамического рендера.
export const dynamicParams = false;

function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}

export function generateStaticParams() {
  const params: { locale: Locale; slug?: string[] }[] = [];
  for (const topic of getPublishedTopics()) {
    for (const locale of LOCALES) {
      const segments = slugSegments(topic, locale);
      params.push(segments.length > 0 ? { locale, slug: segments } : { locale });
    }
  }
  return params;
}

interface RouteParams {
  locale: string;
  slug?: string[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const topic = findTopicBySlug(locale, slug);
  if (!topic) return {};

  const entry = topic.locales[locale];
  const canonical = absoluteUrl(urlFor(topic, locale));
  const pair = localeUrlPair(topic);
  const ogImage = absoluteUrl("/og/default.png");

  return {
    title: entry.title,
    description: entry.description,
    alternates: {
      canonical,
      // x-default указывает на RU-версию темы — правило задачи (§4), RU
      // выбран как язык по умолчанию раздела.
      languages: {
        "ru-UZ": absoluteUrl(pair.ru),
        "uz-UZ": absoluteUrl(pair.uz),
        "x-default": absoluteUrl(pair.ru),
      },
    },
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: canonical,
      siteName: "Contador",
      locale: locale === "ru" ? "ru_UZ" : "uz_UZ",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: entry.title,
      description: entry.description,
      images: [ogImage],
    },
  };
}

export default async function TopicPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const topic = findTopicBySlug(locale, slug);
  if (!topic) notFound();

  const BodyComponent = CONTENT_REGISTRY[topic.id]?.[locale];
  if (!BodyComponent) {
    // Рассинхронизация manifest/registry — тема опубликована, но контента для
    // неё нет. Не показываем пустой шаблон как 200 (§8) — это тоже 404.
    notFound();
  }

  const webPage = webPageJsonLd(topic, locale);
  const breadcrumb = breadcrumbJsonLd(topic, locale);
  const orgWebsite = topic.type === "home" ? organizationAndWebSiteJsonLd() : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }} />
      {breadcrumb && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      )}
      {orgWebsite && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgWebsite) }} />
      )}
      <Header topic={topic} locale={locale} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Breadcrumbs topic={topic} locale={locale} />
        <div className="mt-6">
          <BodyComponent topic={topic} />
        </div>
      </main>
      <Footer locale={locale} />
    </>
  );
}
