import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Тип guide, порядок блоков — TASK-0003 §6. Аннотированная собственная
// таблица (не реальные данные клиента), структура сверена с темой 10:
// v2/src/app/reports/osv/OSVClient.tsx + page.tsx. Правило активного счёта
// (актив увеличивается по дебету) применено к примеру ниже без противоречий
// с FAQ темы 10.
const ROW = { name: "Расчёты с покупателями", opening: "6 500 000", debit: "12 000 000", credit: "9 800 000", closing: "8 700 000" };

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.ru.h1}
        lead="В ОСВ у каждого счёта четыре колонки: начальный остаток, дебетовый оборот, кредитовый оборот и остаток на конец периода. Разберём их на одном аннотированном примере."
      />

      <nav aria-label="Содержание" className="text-sm">
        <p className="font-medium text-black">Содержание</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-columns" className="underline hover:text-black">Что означает каждая колонка</a></li>
          <li><a href="#h2-example" className="underline hover:text-black">Пример движения по счёту</a></li>
          <li><a href="#h2-caveat" className="underline hover:text-black">Почему равенства итогов недостаточно</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-columns">
        <h2 id="h2-columns" className="text-xl font-semibold text-black">
          Что означает каждая колонка
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li><strong className="text-black">Начальный остаток</strong> — сколько было на счёте на начало периода: по введённым начальным остаткам или перенесённое из предыдущего периода.</li>
          <li><strong className="text-black">Дебетовый оборот</strong> — сумма всех проводок по дебету счёта за период.</li>
          <li><strong className="text-black">Кредитовый оборот</strong> — сумма всех проводок по кредиту счёта за период.</li>
          <li><strong className="text-black">Остаток на конец периода</strong> — начальный остаток плюс обороты за период, с учётом того, активный счёт или пассивный.</li>
        </ul>
      </section>

      <section aria-labelledby="h2-example">
        <h2 id="h2-example" className="text-xl font-semibold text-black">
          Пример движения по счёту
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Собственный пример на вымышленных данных — счёт «Расчёты с покупателями» (активный счёт, остаток растёт по
          дебету):
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <caption className="sr-only">Пример ОСВ по одному счёту с пояснением</caption>
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Начало</th>
                <th className="py-2 pr-4 font-medium">Дебет</th>
                <th className="py-2 pr-4 font-medium">Кредит</th>
                <th className="py-2 font-medium">Конец</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 pr-4 text-gray-700">{ROW.opening}</td>
                <td className="py-2 pr-4 text-gray-700">{ROW.debit}</td>
                <td className="py-2 pr-4 text-gray-700">{ROW.credit}</td>
                <td className="py-2 font-medium text-black">{ROW.closing}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Расчёт: 6 500 000 (начало) + 12 000 000 (новые счета клиентам, дебет) − 9 800 000 (оплаты от клиентов,
          кредит) = 8 700 000 (конец). Дебетовый оборот здесь — выставленные счета, кредитовый — полученные оплаты.
        </p>
      </section>

      <section aria-labelledby="h2-caveat">
        <h2 id="h2-caveat" className="text-xl font-semibold text-black">
          Почему равенства итогов недостаточно
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Равенство итоговых сумм по дебету и кредиту всей ведомости подтверждает баланс двойной записи, но не
          проверяет полноту и корректность каждой операции. Если по какому-то счёту не были введены начальные
          остатки, ОСВ покажет заниженные значения именно по этому счёту, хотя итоговое равенство по всей ведомости
          сохранится.
        </p>
      </section>

      <RelatedPages topic={topic} locale="ru" />
      <CTA topicId={topic.id} locale="ru" location="bottom" />
    </div>
  );
}
