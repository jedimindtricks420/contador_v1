"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type BalanceData = Record<string, number> & {
  asOf: string;
  balanceCheck: boolean;
  difference: number;
};

function fmt(n: number, minus?: boolean): React.ReactNode {
  const val = Math.round(minus ? -n : n);
  if (val === 0) return <span className="text-gray-300">—</span>;
  if (val < 0) return <span className="text-rose-600">({new Intl.NumberFormat("ru-RU").format(Math.abs(val))})</span>;
  return <>{new Intl.NumberFormat("ru-RU").format(val)}</>;
}

interface RowProps {
  num: string;
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  total?: boolean;
  minus?: boolean;
  alwaysShow?: boolean;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-50/50">
      <td colSpan={3} className="p-3.5 font-bold text-gray-700 text-xs">{label}</td>
    </tr>
  );
}

function Row({ num, label, value, indent, bold, total, minus, alwaysShow }: RowProps) {
  if (!alwaysShow && value === 0) return null;
  if (total) {
    return (
      <tr className="bg-gray-100/40 border-t-2 border-gray-200">
        <td className="p-3.5 text-xs font-black text-gray-800">{label}</td>
        <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">{num}</td>
        <td className="p-3.5 text-right text-xs font-black font-mono tabular-nums">{fmt(value, minus)}</td>
      </tr>
    );
  }
  return (
    <tr className={`hover:bg-gray-50/50 ${bold ? "bg-gray-50/50" : ""}`}>
      <td className={`p-3.5 text-xs ${bold ? "font-bold text-gray-800" : "font-medium text-gray-700"} ${indent ? "pl-9" : ""}`}>{label}</td>
      <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">{num}</td>
      <td className={`p-3.5 text-right text-xs font-mono tabular-nums ${bold ? "font-bold" : ""}`}>{fmt(value, minus)}</td>
    </tr>
  );
}

export default function BalanceClient() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [toStr, setToStr] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/v2/api/reports/balance?to=${toStr}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [toStr]);

  const d = data as any;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Бухгалтерский баланс</h1>
          <p className="text-xs text-gray-400 mt-0.5">Форма №1 — Активы / Обязательства / Капитал</p>
        </div>
        <div className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
          <span className="text-[10px] text-gray-400">На дату:</span>
          <input
            type="date"
            value={toStr}
            onChange={(e) => setToStr(e.target.value)}
            className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-black font-semibold text-gray-700"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-500 font-medium">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mr-3"></div>
          Загрузка баланса...
        </div>
      )}

      {!loading && d && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* АКТИВ */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                    <th className="p-3.5 min-w-[240px]">АКТИВ</th>
                    <th className="p-3.5 text-center w-12 text-[10px]">Стр.</th>
                    <th className="p-3.5 text-right min-w-[140px]">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  <SectionHeader label="Раздел I. Долгосрочные активы" />
                  <Row num="010" label="Основные средства (перв. стоимость)" value={d.line010} indent />
                  <Row num="011" label="— Износ (накопленная амортизация)" value={d.line011} indent minus />
                  <Row num="012" label="Остаточная стоимость ОС" value={d.line012} indent bold alwaysShow />
                  <Row num="020" label="НМА: первоначальная стоимость" value={d.line020} indent />
                  <Row num="021" label="— Амортизация НМА" value={d.line021} indent minus />
                  <Row num="022" label="Остаточная стоимость НМА" value={d.line022} indent bold />
                  <Row num="030" label="Долгосрочные инвестиции, итого" value={d.line030} bold />
                  <Row num="040" label="в т.ч. дочерние предприятия" value={d.line040} indent />
                  <Row num="050" label="в т.ч. зависимые предприятия" value={d.line050} indent />
                  <Row num="060" label="в т.ч. совместные предприятия" value={d.line060} indent />
                  <Row num="070" label="в т.ч. прочие долгосрочные" value={d.line070} indent />
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
                  <Row num="220" label="в т.ч. покупатели и заказчики" value={d.line220} indent />
                  <Row num="230" label="в т.ч. дочерние предприятия" value={d.line230} indent />
                  <Row num="240" label="в т.ч. зависимые предприятия" value={d.line240} indent />
                  <Row num="250" label="в т.ч. авансы выданные" value={d.line250} indent />
                  <Row num="260" label="в т.ч. авансы поставщикам" value={d.line260} indent />
                  <Row num="270" label="в т.ч. авансы по налогам" value={d.line270} indent />
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

                  <tr className="bg-gray-900 text-white">
                    <td className="p-3.5 text-xs font-black uppercase tracking-wide">ВСЕГО ПО АКТИВУ</td>
                    <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">400</td>
                    <td className="p-3.5 text-right text-sm font-black tabular-nums font-mono">
                      {new Intl.NumberFormat("ru-RU").format(Math.round(d.line400))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ПАССИВ */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                    <th className="p-3.5 min-w-[240px]">ПАССИВ</th>
                    <th className="p-3.5 text-center w-12 text-[10px]">Стр.</th>
                    <th className="p-3.5 text-right min-w-[140px]">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  <SectionHeader label="Раздел I. Собственный капитал" />
                  <Row num="410" label="Уставный капитал" value={d.line410} />
                  <Row num="420" label="Добавленный капитал" value={d.line420} />
                  <Row num="430" label="Резервный капитал" value={d.line430} />
                  <Row num="440" label="— Выкупленные собственные акции" value={d.line440} indent minus />
                  <Row num="450" label="Нераспределённая прибыль (убыток)" value={d.line450} bold alwaysShow />
                  <Row num="460" label="Целевые поступления" value={d.line460} />
                  <Row num="470" label="Резервы предстоящих расходов" value={d.line470} />
                  <Row num="480" label="ИТОГО Раздел I (Капитал)" value={d.line480} total alwaysShow />

                  <SectionHeader label="Раздел II. Долгосрочные обязательства" />
                  <Row num="490" label="Долгосрочные обязательства, итого" value={d.line490} bold alwaysShow />
                  <Row num="500" label="в т.ч. долгосрочные займы" value={d.line500} indent />
                  <Row num="510" label="в т.ч. отсроченные налоговые обяз-ва" value={d.line510} indent />
                  <Row num="520" label="в т.ч. обяз-ва по финансовой аренде" value={d.line520} indent />
                  <Row num="530" label="в т.ч. долгосрочная кредиторская" value={d.line530} indent />
                  <Row num="540" label="в т.ч. авансы полученные (долг.)" value={d.line540} indent />
                  <Row num="550" label="в т.ч. прочие долгосрочные обяз-ва" value={d.line550} indent />

                  <SectionHeader label="Раздел III. Текущие обязательства" />
                  <Row num="600" label="Текущие обязательства, итого" value={d.line600} bold alwaysShow />
                  <Row num="610" label="в т.ч. поставщики и подрядчики" value={d.line610} indent />
                  <Row num="620" label="в т.ч. краткосрочные займы банков" value={d.line620} indent />
                  <Row num="630" label="в т.ч. обяз-ва по аренде (кр.)" value={d.line630} indent />
                  <Row num="640" label="в т.ч. краткосрочная кредиторская" value={d.line640} indent />
                  <Row num="650" label="в т.ч. авансы полученные (кр.)" value={d.line650} indent />
                  <Row num="660" label="в т.ч. прочие краткосрочные" value={d.line660} indent />
                  <Row num="670" label="в т.ч. авансы от покупателей" value={d.line670} indent />
                  <Row num="680" label="в т.ч. задолженность в бюджет" value={d.line680} indent />
                  <Row num="690" label="в т.ч. страхование" value={d.line690} indent />
                  <Row num="700" label="в т.ч. государственные фонды" value={d.line700} indent />
                  <Row num="710" label="в т.ч. расчёты с персоналом (прочие)" value={d.line710} indent />
                  <Row num="720" label="в т.ч. задолженность по оплате труда" value={d.line720} indent />
                  <Row num="730" label="в т.ч. краткосрочные кредиты" value={d.line730} indent />
                  <Row num="740" label="в т.ч. займы (учредители, прочие)" value={d.line740} indent />
                  <Row num="760" label="в т.ч. прочие текущие обязательства" value={d.line760} indent />
                  <Row num="770" label="ИТОГО Раздел II+III (Обязательства)" value={d.line770} total alwaysShow />

                  <tr className="bg-gray-900 text-white">
                    <td className="p-3.5 text-xs font-black uppercase tracking-wide">ВСЕГО ПО ПАССИВУ</td>
                    <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">780</td>
                    <td className="p-3.5 text-right text-sm font-black tabular-nums font-mono">
                      {new Intl.NumberFormat("ru-RU").format(Math.round(d.line780))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Balance check */}
      {!loading && d && (
        <div className={`flex items-center gap-2 p-3.5 text-xs font-bold rounded border ${d.balanceCheck ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {d.balanceCheck ? (
            <><CheckCircle2 size={14} />Баланс сходится: Актив (стр.400) = Пассив (стр.780)</>
          ) : (
            <><AlertTriangle size={14} />Расхождение: {new Intl.NumberFormat("ru-RU").format(Math.round(Math.abs(d.difference)))} сум — проверьте проводки</>
          )}
        </div>
      )}
    </div>
  );
}
