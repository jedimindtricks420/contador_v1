import { localeUrlPair, otherLocale, type Locale, type Topic } from "@/lib/manifest";

// Переключатель языка ведёт на перевод ТОЙ ЖЕ темы по topicId (TASK-0003 §4),
// а не всегда на главную — маршрут строится из manifest, а не хардкодом.
export function LanguageSwitcher({ topic, locale }: { topic: Topic; locale: Locale }) {
  const target = otherLocale(locale);
  const pair = localeUrlPair(topic);
  return (
    <a
      href={pair[target]}
      hrefLang={target === "ru" ? "ru-UZ" : "uz-UZ"}
      className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
    >
      {target === "ru" ? "RU" : "UZ"}
    </a>
  );
}
