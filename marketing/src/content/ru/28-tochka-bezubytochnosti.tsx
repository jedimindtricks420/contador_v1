import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { BreakevenCalculator } from "@/components/tools/BreakevenCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

// Тип tool, порядок блоков — TASK-0003 §6: H1 → рабочий калькулятор → результат
// → формула → пример → ограничения → связанные материалы → CTA. Формулы и
// граничные случаи — §7 «28. Безубыточность»; арифметика — Decimal
// (src/lib/breakeven.ts), не floating point.
export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "ru"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Укажите постоянные расходы, цену единицы и переменные затраты — калькулятор посчитает порог безубыточности и выручку."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Задайте исходные значения
        </h2>
        <div className="mt-4">
          <BreakevenCalculator locale="ru" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-sales">
        <h2 id="h2-sales" className="text-xl font-semibold text-black">
          Продажи для покрытия расходов
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Пока маржинальный доход на единицу (цена минус переменные затраты) положительный, каждая
          проданная единица покрывает часть постоянных расходов. Непрерывный порог — это точная
          математическая величина; поскольку продать долю единицы обычно нельзя, калькулятор отдельно
          показывает округлённое вверх целое число единиц и соответствующую ему выручку — она выше
          выручки непрерывного порога.
        </p>
      </section>

      <section aria-labelledby="h2-formula">
        <h2 id="h2-formula" className="text-xl font-semibold text-black">
          Ограничения модели
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>Маржинальный доход на единицу = Цена − Переменные затраты на единицу</li>
          <li>Непрерывный порог = Постоянные расходы ÷ Маржинальный доход на единицу</li>
          <li>Выручка порога = Порог × Цена</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Пример: постоянные расходы 1 000 000, цена 150 000, переменные затраты 100 000 → порог 20 единиц,
          выручка 3 000 000. Если постоянные расходы 1 025 000 при тех же цене и затратах — непрерывный
          порог 20,5 единицы, округлённо 21 единица, выручка порога при округлении — 3 150 000 (вместо
          3 075 000 у непрерывного порога).
        </p>
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="text-sm font-medium text-black">Ограничения модели</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            <li>
              Модель рассчитана на один продукт с постоянными ценой и затратами за один период в одной
              валюте — она не учитывает автоматически налоги, сезонность или изменение ассортимента.
            </li>
            <li>
              Если цена не превышает переменные затраты на единицу, продажи не создают положительного
              вклада в покрытие постоянных расходов — калькулятор покажет это явно, не деля на ноль и не
              выдавая отрицательный объём продаж.
            </li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="ru" url={canonicalUrl} title={topic.locales.ru.title} />

      <p className="text-sm text-gray-600">
        Проверяйте фактические цены и затраты по вашему бизнесу в отчётах Contador — например, в отчёте о
        прибылях и убытках.
      </p>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
