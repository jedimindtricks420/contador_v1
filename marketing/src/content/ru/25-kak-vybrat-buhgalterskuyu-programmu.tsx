import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6. Таблица критериев с пустой
// колонкой для самооценки читателя — обязательное содержание темы 25.
// Никакого вымышленного рейтинга и сравнения конкурентов: спека прямо это
// запрещает ("Не делать вымышленный рейтинг и неподтверждённое сравнение
// конкурентов. Обозначить авторство Contador").
const CRITERIA = [
  "Какие форматы банковских выписок программа реально импортирует",
  "Как устроена проверка классификации операций — вручную, по правилам, с AI",
  "Есть ли пошаговый процесс закрытия периода с проверками",
  "Какие отчёты доступны из коробки (баланс, P&L, ДДС, ОСВ)",
  "Как устроены роли и доступ нескольких сотрудников к организации",
  "Сколько стоит тариф и какие у него ограничения",
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="Выбор бухгалтерской программы зависит от конкретных задач вашего бизнеса: какие выписки нужно импортировать, как проверяются операции, какие отчёты нужны и сколько сотрудников будет работать в системе. Ниже — список критериев для самостоятельной проверки, не готовый рейтинг программ."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-tasks" className="underline hover:text-black">Составьте список задач</a></li>
          <li><a href="#h2-scenario" className="underline hover:text-black">Проверьте сценарий на примере</a></li>
          <li><a href="#h2-compare" className="underline hover:text-black">Сравните условия и ограничения</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-tasks">
        <h2 id="h2-tasks" className="text-xl font-semibold text-black">
          Составьте список задач
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Прежде чем сравнивать программы, запишите свои реальные задачи: сколько организаций нужно вести, кто
          готовит выписки, кто проверяет классификацию, какие отчёты нужны руководителю. Список задач — основа для
          следующих шагов.
        </p>
      </section>

      <section aria-labelledby="h2-scenario">
        <h2 id="h2-scenario" className="text-xl font-semibold text-black">
          Проверьте сценарий на примере
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Возьмите один реальный сценарий — например, «загрузить выписку за месяц → проверить классификацию операций
          → пройти закрытие периода → получить отчёт о прибылях и убытках» — и проверьте его в каждой рассматриваемой
          программе на демо-доступе. В Contador этот сценарий проходит через мастер закрытия месяца: импорт выписки
          на первом шаге, уточнение категорий на втором, финализация периода на последнем.
        </p>
      </section>

      <section aria-labelledby="h2-compare">
        <h2 id="h2-compare" className="text-xl font-semibold text-black">
          Сравните условия и ограничения
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Материал подготовлен Contador и не содержит сравнения с конкретными конкурентами — мы не проверяли их
          фактические возможности и не публикуем чужие данные. Используйте таблицу ниже, чтобы самостоятельно
          оценить любую рассматриваемую программу, включая Contador, по одинаковым критериям.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Критерии выбора бухгалтерской программы с пустой колонкой для самооценки</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Критерий</th>
                <th className="py-2 font-medium">Ваша оценка</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{c}</td>
                  <td className="py-2 text-gray-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Колонка «Ваша оценка» намеренно пустая — заполните её сами по каждой рассматриваемой программе.</p>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
