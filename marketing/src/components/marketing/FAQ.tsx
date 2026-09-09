import type { FaqItem } from "@/content/seo-pages";
import type { Locale } from "@/lib/manifest";

// details/summary — доступная разметка FAQ без JS (TASK-0003 §6). Специальный
// FAQPage JSON-LD сознательно не добавляется: спека прямо говорит, что
// FAQ-rich-results не входят в обещания/критерии успеха этой задачи.
export function FAQ({ items, locale }: { items: FaqItem[]; locale: Locale }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-semibold text-black">
        {locale === "ru" ? "Частые вопросы" : "Ko‘p so‘raladigan savollar"}
      </h2>
      <dl className="mt-4 divide-y divide-gray-200 border-t border-b border-gray-200">
        {items.map((item) => (
          <details key={item.q} className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-black marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-black">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span aria-hidden className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
              </span>
            </summary>
            <p className="mt-2 text-sm text-gray-600">{item.a}</p>
          </details>
        ))}
      </dl>
    </div>
  );
}
