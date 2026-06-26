"use client";
import { useEffect, useState } from "react";

interface PnLLines {
  line010: number; line020: number; line030: number;
  line040: number; line050: number; line060: number; line070: number; line080: number;
  line090: number; line100: number;
  line110: number; line120: number; line130: number; line140: number; line150: number; line160: number;
  line170: number; line180: number; line200: number; line210: number;
  line220: number; line230: number; line240: number;
  line250: number; line260: number; line270: number;
}

interface PnLData {
  period: { from: string; to: string };
  taxRegime: "VAT" | "TURNOVER_TAX";
  turnoverTaxRate: number;
  lines: PnLLines;
  months: string[];
  monthlyRevenue: number[];
  monthlyNetProfit: number[];
}

const MONTH_NAMES_RU: Record<string, string> = {
  "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр", "05": "Май", "06": "Июн",
  "07": "Июл", "08": "Авг", "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек"
};

function fmtNum(amount: number): React.ReactNode {
  const val = Math.round(amount);
  if (val < 0) {
    return <span className="text-rose-600">({new Intl.NumberFormat("ru-RU").format(Math.abs(val))})</span>;
  }
  if (val === 0) return <span className="text-gray-300">—</span>;
  return <span>{new Intl.NumberFormat("ru-RU").format(val)}</span>;
}

interface RowProps {
  num: string;
  label: string;
  value: number;
  bold?: boolean;
  extraBold?: boolean;
  indent?: boolean;
  alwaysShow?: boolean;
  minus?: boolean;
}

function Row({ num, label, value, bold, extraBold, indent, alwaysShow, minus }: RowProps) {
  if (!alwaysShow && value === 0) return null;
  const display = minus ? -value : value;
  return (
    <tr className={`border-b border-gray-100 ${extraBold ? "bg-gray-100" : bold ? "bg-gray-50" : "hover:bg-gray-50/50"}`}>
      <td className={`py-2 px-3 text-gray-400 text-[10px] font-mono w-12 ${indent ? "pl-8" : ""}`}>{num}</td>
      <td className={`py-2 px-2 text-xs ${extraBold ? "font-black text-gray-900" : bold ? "font-bold text-gray-800" : "font-medium text-gray-700"} ${indent ? "pl-6" : ""}`}>
        {label}
      </td>
      <td className={`py-2 px-3 text-right text-xs font-mono tabular-nums ${extraBold ? "font-black" : bold ? "font-bold" : ""}`}>
        {fmtNum(display)}
      </td>
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-800">
      <td colSpan={3} className="py-1.5 px-3 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{label}</td>
    </tr>
  );
}

export default function PnLClient() {
  const [data, setData] = useState<PnLData | null>(null);
  const [periodType, setPeriodType] = useState<string>("YEAR");

  const now = new Date();
  const [fromStr, setFromStr] = useState<string>(`${now.getFullYear()}-01-01`);
  const [toStr, setToStr] = useState<string>(`${now.getFullYear()}-12-31`);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      let fromDate = fromStr;
      let toDate = toStr;
      const year = now.getFullYear();

      if (periodType === "YEAR") {
        fromDate = `${year}-01-01`;
        toDate   = `${year}-12-31`;
      } else if (periodType === "QUARTER") {
        const q = Math.floor(now.getMonth() / 3);
        const sm = q * 3 + 1;
        const em = q * 3 + 3;
        const ld = new Date(year, em, 0).getDate();
        fromDate = `${year}-${String(sm).padStart(2,"0")}-01`;
        toDate   = `${year}-${String(em).padStart(2,"0")}-${String(ld).padStart(2,"0")}`;
      }

      const res = await fetch(`/v2/api/pnl?from=${fromDate}&to=${toDate}`);
      setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [periodType, fromStr, toStr]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mr-3"></div>
        Загрузка Формы №2...
      </div>
    );
  }

  const L = data?.lines;
  const taxRatePct = data ? Math.round((data.turnoverTaxRate ?? 0.04) * 100) : 4;
  const taxLabel = data?.taxRegime === "VAT"
    ? "Налог на прибыль (15%)"
    : `Налог с оборота (${taxRatePct}%)`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase">Отчёт о финансовых результатах</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Форма №2 (метод начисления)
            {data && (
              <span className={`ml-2 px-1.5 py-0.5 rounded ${data.taxRegime === "VAT" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                {data.taxRegime === "VAT" ? "НДС + Налог на прибыль" : `Налог с оборота ${taxRatePct}%`}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Период:</span>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black font-semibold text-gray-700"
            >
              <option value="YEAR">Текущий год</option>
              <option value="QUARTER">Текущий квартал</option>
              <option value="CUSTOM">Произвольный диапазон</option>
            </select>
          </div>
          {periodType === "CUSTOM" && (
            <div className="flex items-center gap-2 pt-5">
              <input type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 outline-hidden focus:border-black text-gray-700 font-semibold" />
              <span className="text-gray-400">—</span>
              <input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)}
                className="bg-white border border-gray-200 rounded px-2 py-1 outline-hidden focus:border-black text-gray-700 font-semibold" />
            </div>
          )}
        </div>
      </div>

      {/* Таблица Форма №2 */}
      {data && L && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-900 text-gray-200">
                  <th className="py-2.5 px-3 text-[10px] font-bold uppercase w-12">Стр.</th>
                  <th className="py-2.5 px-2 text-[10px] font-bold uppercase">Наименование показателя</th>
                  <th className="py-2.5 px-3 text-right text-[10px] font-bold uppercase min-w-[140px]">Сумма (сум)</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Выручка и себестоимость" />
                <Row num="010" label="Чистая выручка от реализации продукции (товаров, услуг)" value={L.line010} alwaysShow />
                <Row num="020" label="Себестоимость реализованной продукции (товаров, услуг)" value={L.line020} minus />

                <Row num="030" label="ВАЛОВАЯ ПРИБЫЛЬ (УБЫТОК)" value={L.line030} bold alwaysShow />

                <SectionHeader label="Расходы периода" />
                <Row num="050" label="Расходы по реализации" value={L.line050} indent minus />
                <Row num="060" label="Административные расходы" value={L.line060} indent minus />
                <Row num="070" label="Прочие операционные расходы" value={L.line070} indent minus />
                <Row num="080" label="Расходы, вычитаемые в будущем периоде" value={L.line080} indent minus />
                <Row num="040" label="Расходы периода, итого" value={L.line040} bold minus />
                <Row num="090" label="Прочие доходы от основной деятельности" value={L.line090} />

                <Row num="100" label="ПРИБЫЛЬ (УБЫТОК) ОТ ОСНОВНОЙ ДЕЯТЕЛЬНОСТИ" value={L.line100} bold alwaysShow />

                <SectionHeader label="Финансовая деятельность" />
                <Row num="110" label="Доходы от финансовой деятельности, итого" value={L.line110} bold />
                <Row num="120" label="в т.ч. дивиденды" value={L.line120} indent />
                <Row num="130" label="в т.ч. проценты" value={L.line130} indent />
                <Row num="140" label="в т.ч. доходы от аренды" value={L.line140} indent />
                <Row num="150" label="в т.ч. курсовые разницы (положительные)" value={L.line150} indent />
                <Row num="160" label="в т.ч. прочие доходы от финансовой деятельности" value={L.line160} indent />
                <Row num="170" label="Расходы по финансовой деятельности, итого" value={L.line170} bold minus />
                <Row num="180" label="в т.ч. расходы по процентам" value={L.line180} indent minus />
                <Row num="200" label="в т.ч. убытки от курсовых разниц" value={L.line200} indent minus />
                <Row num="210" label="в т.ч. прочие расходы по финансовой деятельности" value={L.line210} indent minus />

                <Row num="220" label="ПРИБЫЛЬ ОТ ОБЩЕХОЗЯЙСТВЕННОЙ ДЕЯТЕЛЬНОСТИ" value={L.line220} bold alwaysShow />
                <Row num="230" label="Чрезвычайные прибыли и убытки (±)" value={L.line230} />

                <Row num="240" label="ПРИБЫЛЬ ДО УПЛАТЫ НАЛОГА" value={L.line240} bold alwaysShow />

                <SectionHeader label="Налоги от прибыли" />
                <Row num="250" label={taxLabel} value={L.line250} minus />
                <Row num="260" label="Прочие налоги, исчисляемые от прибыли" value={L.line260} minus />

                <Row num="270" label="ЧИСТАЯ ПРИБЫЛЬ (УБЫТОК)" value={L.line270} extraBold alwaysShow />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Помесячный разрез */}
      {data && data.months.length > 1 && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Помесячный разрез</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-2 px-3 font-bold text-gray-600 text-left min-w-[160px]">Показатель</th>
                  {data.months.map(m => {
                    const [, mo] = m.split("-");
                    return <th key={m} className="py-2 px-2 font-bold text-gray-500 text-right whitespace-nowrap">{MONTH_NAMES_RU[mo]}</th>;
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50/50">
                  <td className="py-2 px-3 font-semibold text-gray-700">Выручка (стр.010)</td>
                  {data.monthlyRevenue.map((v, i) => (
                    <td key={i} className="py-2 px-2 text-right font-mono">{fmtNum(v)}</td>
                  ))}
                </tr>
                <tr className="hover:bg-gray-50/50 bg-gray-50 font-bold">
                  <td className="py-2 px-3 font-bold text-gray-800">Чистая прибыль (стр.270)</td>
                  {data.monthlyNetProfit.map((v, i) => (
                    <td key={i} className="py-2 px-2 text-right font-mono font-bold">{fmtNum(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
