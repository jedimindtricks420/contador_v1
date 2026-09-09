import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import { TurnoverTaxCalculator } from "@/components/tools/TurnoverTaxCalculator";
import { urlFor } from "@/lib/manifest";
import { absoluteUrl } from "@/lib/site";
import type { Topic } from "@/lib/manifest";

// Тип tool, порядок блоков — TASK-0003 §6, наследуется TASK-0004 §5. Формула —
// публичная статутная математика Налогового кодекса (Оборот × Ставка / 100), а
// НЕ имитация внутренней бизнес-логики продукта — раздел 2.3 TASK-0004.
// Арифметика — Decimal (src/lib/turnoverTax.ts), не floating point. Ставка —
// обязательное поле без "правильного" дефолта (см. компонент калькулятора).
export default function Body({ topic }: { topic: Topic }) {
  const canonicalUrl = absoluteUrl(urlFor(topic, "ru"));

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Введите оборот за период и свою ставку налога с оборота — калькулятор посчитает сумму налога по формуле Налогового кодекса."
      />

      <section aria-labelledby="h2-input">
        <h2 id="h2-input" className="text-xl font-semibold text-black">
          Введите оборот и ставку
        </h2>
        <div className="mt-4">
          <TurnoverTaxCalculator locale="ru" topicId={topic.id} />
        </div>
      </section>

      <section aria-labelledby="h2-formula">
        <h2 id="h2-formula" className="text-xl font-semibold text-black">
          Формула расчёта
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          <li>Налог с оборота = Оборот за период × Ставка (%) ÷ 100</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Пример: оборот 50 000 000 сум, ставка 4% → налог 2 000 000 сум.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Ставку выбирает сама организация в пределах, установленных законодательством, — обычный диапазон 1–4%.
          Калькулятор не подставляет ставку по умолчанию: это обязательное поле, которое вы заполняете сами по
          своему налоговому статусу.
        </p>
      </section>

      <section aria-labelledby="h2-limits">
        <h2 id="h2-limits" className="text-xl font-semibold text-black">
          Ограничения расчёта
        </h2>
        <div className="mt-4 rounded border border-gray-200 p-4">
          <ul className="space-y-1 text-sm text-gray-600">
            <li>Ставка вне диапазона 1–4% не блокируется — существуют льготные категории с иной ставкой, но калькулятор покажет предупреждение, чтобы вы дополнительно проверили свой статус.</li>
            <li>Калькулятор не учитывает льготы, вычеты и особые режимы налогообложения — только прямое умножение оборота на указанную ставку.</li>
            <li>Предварительный расчёт по указанной вами ставке; не официальная декларация, не учитывает льготы и вычеты.</li>
          </ul>
        </div>
      </section>

      <ShareButtons topicId={topic.id} locale="ru" url={canonicalUrl} title={topic.locales.ru.title} />

      <p className="text-sm text-gray-600">
        Сверяйте реальные обороты вашей организации в отчётах Contador — например, в отчёте о прибылях и убытках.
      </p>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
