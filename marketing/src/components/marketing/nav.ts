import { getTopicById, urlFor, type Locale } from "@/lib/manifest";
import { APP_LOGIN_URL } from "@/lib/site";

// Пункты меню — TASK-0003 §6. Пункт для ещё не построенной темы просто не
// попадает в список (checkNavItems фильтрует по contentStatus === "published"):
// это соответствует правилу "скрывать только непубликованные пункты, не
// оставлять ссылки на 404". Фаза 2: "Для бухгалтеров" (14) и "Для
// руководителей" (15) построены и добавлены в меню. Хаб "Руководства" (18) всё
// ещё не построен — пункт скрыт; тема 21 (чек-лист) доступна по прямой ссылке
// из hub 26 и связанных страниц, а не из этого верхнего меню, пока хаб 18 не
// опубликован.
// Фаза 3: тема 16 ("Для компаний услуг", audience) построена, но НЕ добавлена
// в меню — §6 "Меню RU/UZ" фиксирует ровно 7 пунктов дословно, и 16 в этом
// списке нет (в отличие от 14/15, которые в списке есть буквально: "Для
// бухгалтеров", "Для руководителей"). Решение при ревью 2026-09-09: меню
// оставить как в задаче, а 16 оставить достижимой через relatedIds-ссылки со
// страниц 06/08/13 (уже проставлены) и через sitemap — это соответствует духу
// §6 (нет orphan-страниц: у 16 есть входящие ссылки), не нарушая буквально
// зафиксированный список меню.
const NAV_TOPIC_IDS = ["02", "14", "15", "26", "17"] as const;

const LABELS: Record<Locale, Record<(typeof NAV_TOPIC_IDS)[number], string>> = {
  ru: {
    "02": "Возможности",
    "14": "Для бухгалтеров",
    "15": "Для руководителей",
    "26": "Инструменты",
    "17": "Тарифы",
  },
  uz: {
    "02": "Imkoniyatlar",
    "14": "Buxgalterlar uchun",
    "15": "Rahbarlar uchun",
    "26": "Vositalar",
    "17": "Tariflar",
  },
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
