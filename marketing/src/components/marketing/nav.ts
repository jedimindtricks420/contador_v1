import { getTopicById, urlFor, type Locale } from "@/lib/manifest";
import { APP_LOGIN_URL } from "@/lib/site";

// Пункты меню — TASK-0003 §6. Пункт для ещё не построенной темы просто не
// попадает в список (checkNavItems фильтрует по contentStatus === "published"):
// это соответствует правилу "скрывать только непубликованные пункты, не
// оставлять ссылки на 404". "Для бухгалтеров" (14), "Для руководителей" (15)
// и хаб "Руководства" (18) не построены в фазе 1 — пункты меню скрыты; тема
// 21 (чек-лист) доступна по прямой ссылке из hub 26 и связанных страниц, а не
// из этого верхнего меню, пока хаб 18 не опубликован.
const NAV_TOPIC_IDS = ["02", "26", "17"] as const;

const LABELS: Record<Locale, Record<(typeof NAV_TOPIC_IDS)[number], string>> = {
  ru: { "02": "Возможности", "26": "Инструменты", "17": "Тарифы" },
  uz: { "02": "Imkoniyatlar", "26": "Vositalar", "17": "Tariflar" },
};

export interface NavItem {
  label: string;
  href: string;
}

export function getNavItems(locale: Locale): NavItem[] {
  const items: NavItem[] = [];
  for (const id of NAV_TOPIC_IDS) {
    const topic = getTopicById(id);
    if (!topic || topic.contentStatus !== "published") continue;
    items.push({ label: LABELS[locale][id], href: urlFor(topic, locale) });
  }
  return items;
}

export function getLoginNavItem(locale: Locale): NavItem {
  return { label: locale === "ru" ? "Войти" : "Kirish", href: APP_LOGIN_URL };
}
