"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import ClientLayout from "@/components/Layout/ClientLayout";

type BalanceData = Record<string, number> & {
  asOf: string;
  balanceCheck: boolean;
  difference: number;
};

function fmt(n: number, minus?: boolean) {
  const val = Math.round(minus ? -n : n);
  if (val === 0) return <span className="text-gray-300">—</span>;
  return (
    <span className={val < 0 ? "text-rose-600" : ""}>
      {new Intl.NumberFormat("ru-RU").format(Math.abs(val))}
      {val < 0 ? " (убыток)" : ""}
    </span>
  );
}

interface RowProps {
  num: string;
  label: string;
  value: number;
  bold?: boolean;
  total?: boolean;
  indent?: boolean;
  minus?: boolean;
  alwaysShow?: boolean;
}

function Row({ num, label, value, bold, total, indent, minus, alwaysShow }: RowProps) {
  if (!alwaysShow && value === 0) return null;
  return (
    <tr className={`border-b border-gray-100 ${total ? "bg-gray-200" : bold ? "bg-gray-100" : "hover:bg-gray-50/50"}`}>
      <td className={`py-1.5 px-2 text-gray-400 text-[10px] font-mono w-10 ${indent ? "pl-6" : ""}`}>{num}</td>
      <td className={`py-1.5 px-2 text-xs ${total ? "font-black text-gray-900" : bold ? "font-bold text-gray-800" : "font-medium text-gray-700"} ${indent ? "pl-4" : ""}`}>
        {label}
      </td>
      <td className={`py-1.5 px-3 text-right text-xs font-mono tabular-nums ${total ? "font-black" : bold ? "font-bold" : ""}`}>
        {fmt(value, minus)}
      </td>
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-700">
      <td colSpan={3} className="py-1.5 px-2 text-[10px] font-bold text-gray-200 uppercase tracking-wider">{label}</td>
    </tr>
  );
}

export default function BalancePage() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [toStr, setToStr] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,"0")}`
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/v2/api/reports/balance?to=${toStr}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [toStr]);

  const d = data as any;

  return (
    <ClientLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900 uppercase">Бухгалтерский баланс</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Форма №1 — Активы / Обязательства / Капитал</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <span>На дату:</span>
            <input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)}
              className="bg-white border border-gray-200 px-2.5 py-1.5 outline-none focus:border-black" />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mr-3"></div>
            Загрузка баланса...
          </div>
        )}

        {!loading && d && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* АКТИВ */}
            <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-black text-white text-xs font-black uppercase tracking-widest px-4 py-2.5">АКТИВ</div>
              <table className="w-full border-collapse">
                <tbody>
                  <SectionHeader label="Раздел I. Долгосрочные активы" />
                  <Row num="010" label="Основные средства: перв. стоимость" value={d.line010} />
                  <Row num="011" label="— Износ (накопленный)" value={d.line011} indent minus />
                  <Row num="012" label="Остаточная стоимость ОС" value={d.line012} bold alwaysShow />
                  <Row num="020" label="НМА: первоначальная стоимость" value={d.line020} />
                  <Row num="021" label="— Амортизация НМА" value={d.line021} indent minus />
                  <Row num="022" label="Остаточная стоимость НМА" value={d.line022} bold />
                  <Row num="030" label="Долгосрочные инвестиции, итого" value={d.line030} bold />
                  <Row num="040" label="в т.ч. дочерние предприятия" value={d.line040} indent />
                  <Row num="050" label="в т.ч. зависимые предприятия" value={d.line050} indent />
                  <Row num="060" label="в т.ч. совместные предприятия" value={d.line060} indent />
                  <Row num="070" label="в т.ч. прочие долгосрочные инвестиции" value={d.line070} indent />
                  <Row num="090" label="Оборудование к установке" value={d.line090} />
                  <Row num="100" label="Капитальные вложения" value={d.line100} />
                  <Row num="110" label="Долгосрочная дебиторская задолженность" value={d.line110} />
                  <Row num="120" label="Долгосрочные отсроченные расходы" value={d.line120} />
                  <Row num="130" label="ИТОГО Раздел I" value={d.line130} total alwaysShow />

                  <SectionHeader label="Раздел II. Текущие активы" />
                  <Row num="140" label="Товарно-материальные запасы, итого" value={d.line140} bold />
                  <Row num="150" label="в т.ч. производственные запасы" value={d.line150} indent />
                  <Row num="160" label="в т.ч. незавершённое производство" value={d.line160} indent />
                  <Row num="170" label="в т.ч. готовая продукция" value={d.line170} indent />
                  <Row num="180" label="в т.ч. товары" value={d.line180} indent />
                  <Row num="190" label="Расходы будущих периодов" value={d.line190} />
                  <Row num="200" label="Отсроченные расходы" value={d.line200} />
                  <Row num="210" label="Дебиторская задолженность, итого" value={d.line210} bold />
                  <Row num="220" label="в т.ч. покупатели и заказчики (за вычетом резерва)" value={d.line220} indent />
                  <Row num="230" label="в т.ч. дочерние предприятия" value={d.line230} indent />
                  <Row num="240" label="в т.ч. зависимые предприятия" value={d.line240} indent />
                  <Row num="250" label="в т.ч. авансы выданные" value={d.line250} indent />
                  <Row num="260" label="в т.ч. авансы поставщикам" value={d.line260} indent />
                  <Row num="270" label="в т.ч. авансы по налогам и страхованию" value={d.line270} indent />
                  <Row num="290" label="в т.ч. задолженность учредителей" value={d.line290} indent />
                  <Row num="300" label="в т.ч. задолженность персонала" value={d.line300} indent />
                  <Row num="310" label="в т.ч. прочая дебиторская задолженность" value={d.line310} indent />
                  <Row num="320" label="Денежные средства, итого" value={d.line320} bold />
                  <Row num="330" label="в т.ч. касса" value={d.line330} indent />
                  <Row num="340" label="в т.ч. расчётный счёт (UZS)" value={d.line340} indent />
                  <Row num="350" label="в т.ч. валютные счета" value={d.line350} indent />
                  <Row num="360" label="в т.ч. прочие денежные средства" value={d.line360} indent />
                  <Row num="370" label="Краткосрочные инвестиции" value={d.line370} />
                  <Row num="380" label="Прочие текущие активы" value={d.line380} />
                  <Row num="390" label="ИТОГО Раздел II" value={d.line390} total alwaysShow />

                  <tr className="bg-black text-white">
                    <td className="py-2 px-2 text-[10px] font-mono">400</td>
                    <td className="py-2 px-2 text-xs font-black uppercase tracking-wide">ВСЕГО ПО АКТИВУ</td>
                    <td className="py-2 px-3 text-right text-sm font-black tabular-nums">
                      {new Intl.NumberFormat("ru-RU").format(Math.round(d.line400))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ПАССИВ */}
            <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-black text-white text-xs font-black uppercase tracking-widest px-4 py-2.5">ПАССИВ</div>
              <table className="w-full border-collapse">
                <tbody>
                  <SectionHeader label="Раздел I. Собственный капитал" />
                  <Row num="410" label="Уставный капитал" value={d.line410} />
                  <Row num="420" label="Добавленный капитал" value={d.line420} />
                  <Row num="430" label="Резервный капитал" value={d.line430} />
                  <Row num="440" label="— Выкупленные собственные акции" value={d.line440} indent minus />
                  <Row num="450" label="Нераспределённая прибыль (непокрытый убыток)" value={d.line450} bold alwaysShow />
                  <Row num="460" label="Целевые поступления" value={d.line460} />
                  <Row num="470" label="Резервы предстоящих расходов" value={d.line470} />
                  <Row num="480" label="ИТОГО Раздел I (Капитал)" value={d.line480} total alwaysShow />

                  <SectionHeader label="Раздел II. Обязательства" />
                  <Row num="490" label="Долгосрочные обязательства, итого" value={d.line490} bold />
                  <Row num="500" label="в т.ч. долгосрочные займы" value={d.line500} indent />
                  <Row num="510" label="в т.ч. отсроченные налоговые обязательства" value={d.line510} indent />
                  <Row num="520" label="в т.ч. обязательства по финансовой аренде" value={d.line520} indent />
                  <Row num="530" label="в т.ч. долгосрочная кредиторская задолженность" value={d.line530} indent />
                  <Row num="540" label="в т.ч. авансы полученные (долгосрочные)" value={d.line540} indent />
                  <Row num="550" label="в т.ч. прочие долгосрочные обязательства" value={d.line550} indent />
                  <Row num="560" label="в т.ч. задолженность дочерним предприятиям" value={d.line560} indent />
                  <Row num="570" label="в т.ч. долгосрочные облигации" value={d.line570} indent />
                  <Row num="580" label="в т.ч. прочие долгосрочные ценные бумаги" value={d.line580} indent />
                  <Row num="590" label="в т.ч. прочие долгосрочные обяз-ва" value={d.line590} indent />

                  <Row num="600" label="Текущие обязательства, итого" value={d.line600} bold alwaysShow />
                  <Row num="610" label="в т.ч. поставщики и подрядчики" value={d.line610} indent />
                  <Row num="620" label="в т.ч. краткосрочные займы банков" value={d.line620} indent />
                  <Row num="630" label="в т.ч. обязательства по финансовой аренде (кр.)" value={d.line630} indent />
                  <Row num="640" label="в т.ч. краткосрочная кредиторская задолженность" value={d.line640} indent />
                  <Row num="650" label="в т.ч. авансы полученные (кр.)" value={d.line650} indent />
                  <Row num="660" label="в т.ч. прочие краткосрочные обязательства" value={d.line660} indent />
                  <Row num="670" label="в т.ч. авансы от покупателей" value={d.line670} indent />
                  <Row num="680" label="в т.ч. задолженность в бюджет (6410)" value={d.line680} indent />
                  <Row num="690" label="в т.ч. страхование" value={d.line690} indent />
                  <Row num="700" label="в т.ч. государственные фонды" value={d.line700} indent />
                  <Row num="710" label="в т.ч. прочие обязательства по оплате" value={d.line710} indent />
                  <Row num="720" label="в т.ч. задолженность по оплате труда" value={d.line720} indent />
                  <Row num="730" label="в т.ч. краткосрочные кредиты" value={d.line730} indent />
                  <Row num="740" label="в т.ч. займы (учредители, прочие)" value={d.line740} indent />
                  <Row num="750" label="в т.ч. прочие задолженности по счетам 69xx" value={d.line750} indent />
                  <Row num="760" label="в т.ч. прочие текущие обязательства" value={d.line760} indent />
                  <Row num="770" label="ИТОГО Раздел II (Обязательства)" value={d.line770} total alwaysShow />

                  <tr className="bg-black text-white">
                    <td className="py-2 px-2 text-[10px] font-mono">780</td>
                    <td className="py-2 px-2 text-xs font-black uppercase tracking-wide">ВСЕГО ПО ПАССИВУ</td>
                    <td className="py-2 px-3 text-right text-sm font-black tabular-nums">
                      {new Intl.NumberFormat("ru-RU").format(Math.round(d.line780))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && d && (
          <div className={`flex items-center gap-3 p-3 text-xs font-bold rounded border ${d.balanceCheck ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {d.balanceCheck ? (
              <><CheckCircle2 size={14} className="inline mr-1.5 text-green-600" />Баланс сходится: Актив (стр.400) = Пассив (стр.780)</>
            ) : (
              <><AlertTriangle size={14} className="inline mr-1.5" />Расхождение: {new Intl.NumberFormat("ru-RU").format(Math.round(Math.abs(d.difference)))} сум. Проверьте проводки.</>
            )}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
