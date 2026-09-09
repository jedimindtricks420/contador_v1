import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип home, порядок блоков — TASK-0003 §6: H1 и обещание → 3 шага → скриншот
// → функции → аудитории → реальные условия → FAQ → CTA.
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Загружайте банковские выписки, проверяйте операции и получайте бухгалтерские отчёты в одном сервисе."
      >
        <div className="mt-6">
          <CTA topicId={topic.id} locale="ru" location="hero" />
        </div>
      </Hero>

      <section aria-labelledby="h2-flow">
        <h2 id="h2-flow" className="text-xl font-semibold text-black">
          От выписки к отчёту
        </h2>
        <div className="mt-4">
          <FeatureSteps
            steps={[
              { num: 1, title: "Импорт", desc: "Загрузите банковскую выписку в поддерживаемом формате." },
              { num: 2, title: "Проверка", desc: "Проверьте предложенные категории операций и уточните неоднозначные." },
              { num: 3, title: "Отчёт", desc: "Сформируйте баланс, отчёт о прибылях и убытках или другой отчёт по данным учёта." },
            ]}
          />
        </div>
      </section>

      <ProductScreenshot alt="Личный кабинет Contador: список операций после импорта выписки" priority />

      <section aria-labelledby="h2-features">
        <h2 id="h2-features" className="text-xl font-semibold text-black">
          Возможности для вашей работы
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Импорт выписок</p>
            <p className="mt-1 text-sm text-gray-600">Excel и 1CClientBankExchange, с проверкой на повторный импорт.</p>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Проводки и закрытие месяца</p>
            <p className="mt-1 text-sm text-gray-600">Проверенные шаблоны проводок и пошаговый мастер закрытия периода.</p>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Отчёты</p>
            <p className="mt-1 text-sm text-gray-600">Баланс, отчёт о прибылях и убытках, движение денежных средств, ОСВ.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-start">
        <h2 id="h2-start" className="text-xl font-semibold text-black">
          Как начать
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Понадобятся банковские выписки в поддерживаемом формате и начальные остатки по счетам на дату начала
          учёта. Интерфейс личного кабинета сейчас на русском языке.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Бухгалтеру</p>
            <p className="mt-1 text-sm text-gray-600">
              Импорт выписок, проверка классификации и проводок, подготовка отчётов за период.
            </p>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Руководителю</p>
            <p className="mt-1 text-sm text-gray-600">
              Прибыль, движение денег и бухгалтерские отчёты для понимания результатов бизнеса.
            </p>
          </div>
        </div>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" withLogin />
    </div>
  );
}
