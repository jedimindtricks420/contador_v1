import { TOPICS, LOCALES, type Locale, type Topic, type LocaleContent } from "@/content/seo-pages";

export { LOCALES, TOPICS };
export type { Locale, Topic, LocaleContent };

export function getPublishedTopics(): Topic[] {
  return TOPICS.filter((t) => t.contentStatus === "published");
}

export function getTopicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

/** URL-путь темы на указанной локали, вида "/ru/vozmozhnosti/zakrytie-mesyaca/". */
export function urlFor(topic: Topic, locale: Locale): string {
  const entry = topic.locales[locale];
  return `/${locale}/${entry.path ? `${entry.path}/` : ""}`;
}

/** Слаг-сегменты для generateStaticParams / поиска темы по (locale, slug[]). */
export function slugSegments(topic: Topic, locale: Locale): string[] {
  const entry = topic.locales[locale];
  return entry.path ? entry.path.split("/") : [];
}

/** Найти опубликованную тему по локали и сегментам URL (после /:locale/). */
export function findTopicBySlug(locale: Locale, slug: string[] | undefined): Topic | undefined {
  const path = (slug ?? []).join("/");
  return getPublishedTopics().find((t) => t.locales[locale]?.path === path);
}

/** Резолвит relatedIds темы в опубликованные темы (никогда не 404). */
export function getRelatedTopics(topic: Topic): Topic[] {
  const published = new Set(getPublishedTopics().map((t) => t.id));
  return topic.relatedIds
    .filter((id) => published.has(id))
    .map((id) => getTopicById(id))
    .filter((t): t is Topic => Boolean(t));
}

export function getParentTopic(topic: Topic): Topic | undefined {
  if (!topic.parentId) return undefined;
  const parent = getTopicById(topic.parentId);
  return parent && parent.contentStatus === "published" ? parent : undefined;
}

/** Цепочка хлебных крошек: Главная → (родитель, если есть) → текущая тема. */
export function getBreadcrumbChain(topic: Topic, locale: Locale): { label: string; href: string }[] {
  const home = TOPICS.find((t) => t.type === "home");
  const chain: { label: string; href: string }[] = [];
  if (home && home.id !== topic.id) {
    chain.push({ label: locale === "ru" ? "Главная" : "Bosh sahifa", href: urlFor(home, locale) });
  }
  const parent = getParentTopic(topic);
  if (parent) {
    chain.push({ label: parent.locales[locale].h1, href: urlFor(parent, locale) });
  }
  if (home && home.id !== topic.id) {
    chain.push({ label: topic.locales[locale].h1, href: urlFor(topic, locale) });
  }
  return chain;
}

/** Другая локаль той же темы — для переключателя языка (по topicId, не всегда home). */
export function otherLocale(locale: Locale): Locale {
  return locale === "ru" ? "uz" : "ru";
}

export function localeUrlPair(topic: Topic): Record<Locale, string> {
  return {
    ru: urlFor(topic, "ru"),
    uz: urlFor(topic, "uz"),
  };
}
