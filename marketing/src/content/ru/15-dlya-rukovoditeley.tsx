import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип audience. Evidence phase2-evidence.md: из relatedIds спеки (08, 09, 22,
// 29) построена только тема 08 (P&L) — только на неё и ссылаемся; 09/22/29 не
// существуют в этой фазе и не упоминаются как готовые функции.
const QUESTIONS = [
  {
    q: "Сколько прибыли заработал бизнес за месяц?",
    a: "Отвечает отчёт о прибылях и убытках: доходы, расходы и финансовый результат за выбранный период.",
  },
  {
    q: "Сколько денег сейчас на счетах?",
    a: "Это фактический остаток по банковским счетам в моменте — отдельный вопрос от прибыли за период, обсуждается с бухгалтером по данным учёта.",
  },
  {
    q: "На что уходят основные расходы?",
    a: "Структуру расходов за период также видно в отчёте о прибылях и убытках — это отправная точка для разговора с бухгалтером.",
  },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.ru.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Руководителю не обязательно вести учёт самому — достаточно понимать, какие вопросы задать бухгалтеру и какой отчёт открыть."
      />

      <section aria-labelledby="h2-money">
        <h2 id="h2-money" className="text-xl font-semibold text-black">
          Прибыль и деньги на счёте
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Частая путаница руководителя — считать деньги на счёте прибылью. Это разные показатели: прибыль
          отражает результат за период по данным учёта, а остаток на счёте — фактические деньги в конкретный
          момент. Они могут заметно расходиться, например если клиент ещё не оплатил выставленный счёт.
        </p>
      </section>


      <section aria-labelledby="h2-questions">
        <h2 id="h2-questions" className="text-xl font-semibold text-black">
          Вопросы бухгалтеру
        </h2>
        <div className="mt-4 space-y-3">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="rounded border border-gray-200 p-4">
              <p className="font-medium text-black">{item.q}</p>
              <p className="mt-1 text-sm text-gray-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h2-open">
        <h2 id="h2-open" className="text-xl font-semibold text-black">
          Какие отчёты открыть
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Пример: в конце месяца руководитель открывает отчёт о прибылях и убытках за сентябрь, видит финансовый
          результат и обсуждает с бухгалтером расхождение между прибылью и остатком на счетах. Contador не
          формирует прогнозный бюджет и не заменяет финансового директора — отчёты показывают фактические данные
          за прошедший период, а не прогноз.
        </p>
      </section>

      <FAQ items={faq} locale="ru" />
      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
