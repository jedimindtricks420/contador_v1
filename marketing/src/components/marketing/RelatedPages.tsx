import { getRelatedTopics, urlFor, type Locale, type Topic } from "@/lib/manifest";

// Резолвит relatedIds только через опубликованные темы — никогда не создаёт
// ссылку на ещё не построенную страницу (TASK-0003 §6 "Перелинковка").
export function RelatedPages({ topic, locale }: { topic: Topic; locale: Locale }) {
  const related = getRelatedTopics(topic);
  if (related.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-semibold text-black">
        {locale === "ru" ? "Связанные страницы" : "Bog‘liq sahifalar"}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {related.map((r) => (
          <li key={r.id}>
            <a
              href={urlFor(r, locale)}
              className="block rounded border border-gray-200 p-4 text-sm font-medium text-black hover:border-black transition-colors"
            >
              {r.locales[locale].h1}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
