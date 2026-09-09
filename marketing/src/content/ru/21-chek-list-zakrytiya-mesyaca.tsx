import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { ChecklistWidget } from "@/components/tools/ChecklistWidget";
import { urlFor, getTopicById } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

// Тип checklist, порядок блоков — TASK-0003 §6: краткая цель → интерактивные
// пункты → прогресс → сброс/печать/поделиться → мастер закрытия.
// Работает полностью без аккаунта, локально в браузере (localStorage) — см.
// src/components/tools/ChecklistWidget.tsx.
export default function Body({ topic }: { topic: Topic }) {
  const wizard = getTopicById("06");
  const canonicalUrl = absoluteUrl(urlFor(topic, "ru"));

  return (
    <div className="space-y-8">
      <Hero
        h1={topic.locales.ru.h1}
        lead="10 пунктов для самопроверки перед закрытием месяца. Отметки сохраняются только в вашем браузере."
      />

      <ChecklistWidget locale="ru" topicId={topic.id} canonicalUrl={canonicalUrl} />

      {wizard && (
        <section className="rounded border border-gray-200 bg-[var(--muted-bg)] p-6">
          <h2 className="text-lg font-semibold text-black">Готовы перейти к мастеру закрытия?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Чек-лист не заменяет мастер закрытия месяца в кабинете — это отдельный инструмент для самопроверки.
          </p>
          <a href={urlFor(wizard, "ru")} className="mt-4 inline-block text-sm font-medium text-black underline">
            Как устроен мастер закрытия →
          </a>
        </section>
      )}

      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
