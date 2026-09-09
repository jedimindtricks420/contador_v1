import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Реальные 7 шагов мастера закрытия — evidence: v2/src/app/closing/ClosingWizard.tsx:154-176.
// 8-й условный шаг ("Подтверждение ЭСФ") появляется только когда у организации
// есть электронные счета-фактуры — упомянут отдельно, не выдаётся за базовый шаг.
const STEPS = [
  { num: 1, title: "Импорт выписки", desc: "Проверка импортированных транзакций." },
  { num: 2, title: "Уточнение категорий", desc: "Классификация нераспознанных операций." },
  { num: 3, title: "Проверка реестра", desc: "Контроль нераспределённых платежей." },
  { num: 4, title: "Начисления периода", desc: "ФОТ, амортизация, аренда." },
  { num: 5, title: "Курсовые разницы", desc: "Переоценка валютных счетов." },
  { num: 6, title: "Сверка с Soliq", desc: "Сравнение ЭСФ и авансов." },
  { num: 7, title: "Финализация", desc: "Блокировка и расчёт налогов." },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Мастер закрытия проводит период по фиксированным шагам — от импорта выписки до финализации и блокировки операций."
      />

      <section aria-labelledby="h2-stages">
        <h2 id="h2-stages" className="text-xl font-semibold text-black">
          Этапы закрытия периода
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Для старта нужны импортированные и разнесённые банковские операции за период. Мастер обычно состоит из
          семи шагов; если у организации есть электронные счета-фактуры, между сверкой с Soliq и финализацией
          добавляется отдельный шаг подтверждения ЭСФ.
        </p>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
      </section>


      <section aria-labelledby="h2-pending">
        <h2 id="h2-pending" className="text-xl font-semibold text-black">
          Незавершённые операции
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Каждый шаг показывает свой статус и причину, которая мешает перейти дальше — например, шаг «Уточнение
          категорий» остаётся незавершённым, пока в периоде есть операции без подтверждённой категории.
        </p>
      </section>

      <section aria-labelledby="h2-final-check">
        <h2 id="h2-final-check" className="text-xl font-semibold text-black">
          Проверка перед финализацией
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Шаг «Сверка с Soliq» сравнивает данные счетов-фактур и авансов, но не устраняет расхождения
          автоматически — это остаётся задачей пользователя. Финализация блокирует операции периода от изменений
          и делает доступными отчёты за месяц.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Перед прохождением мастера можно самостоятельно свериться по бесплатному чек-листу закрытия месяца —
          он не привязан к мастеру и доступен без регистрации.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
