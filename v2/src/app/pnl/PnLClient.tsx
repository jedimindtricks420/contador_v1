"use client";
import { useEffect, useState } from "react";
import { TAX_RATES } from "@/lib/constants";

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
  "07": "Июл", "08": "Авг", "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек",
};

function fmt(n: number, minus?: boolean): React.ReactNode {
  const val = Math.round(minus ? -n : n);
  if (val === 0) return <span className="text-gray-300">—</span>;
  if (val < 0) return <span className="text-rose-600">({new Intl.NumberFormat("ru-RU").format(Math.abs(val))})</span>;
  return <>{new Intl.NumberFormat("ru-RU").format(val)}</>;
}

function fmtNum(n: number): string {
  const val = Math.round(n);
  if (val === 0) return "—";
  if (val < 0) return `(${new Intl.NumberFormat("ru-RU").format(Math.abs(val))})`;
  return new Intl.NumberFormat("ru-RU").format(val);
}

interface RowProps {
  num: string;
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  total?: boolean;
  grandTotal?: boolean;
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

function Row({ num, label, value, indent, bold, total, grandTotal, minus, alwaysShow }: RowProps) {
  if (!alwaysShow && value === 0) return null;

  if (grandTotal) {
    return (
      <tr className="bg-gray-900 text-white">
        <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">{num}</td>
        <td className="p-3.5 text-xs font-black uppercase tracking-wide">{label}</td>
        <td className="p-3.5 text-right text-sm font-black font-mono tabular-nums">{fmt(value, minus)}</td>
      </tr>
    );
  }

  if (total) {
    return (
      <tr className="bg-gray-100/40 border-t-2 border-gray-200">
        <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">{num}</td>
        <td className="p-3.5 text-xs font-black text-gray-800">{label}</td>
        <td className="p-3.5 text-right text-xs font-black font-mono tabular-nums">{fmt(value, minus)}</td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-gray-50/50 ${bold ? "bg-gray-50/50" : ""}`}>
      <td className="p-3.5 text-center text-[10px] font-mono text-gray-400">{num}</td>
      <td className={`p-3.5 text-xs ${bold ? "font-bold text-gray-800" : "font-medium text-gray-700"} ${indent ? "pl-9" : ""}`}>
        {label}
      </td>
      <td className={`p-3.5 text-right text-xs font-mono tabular-nums ${bold ? "font-bold" : ""}`}>
        {fmt(value, minus)}
      </td>
    </tr>
  );
}

export default function PnLClient() {
  const [data, setData] = useState<PnLData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<string>("YEAR");

  const now = new Date();
  const [fromStr, setFromStr] = useState<string>(`${now.getFullYear()}-01-01`);
  const [toStr, setToStr] = useState<string>(`${now.getFullYear()}-12-31`);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let fromDate = fromStr;
      let toDate = toStr;
      const year = now.getFullYear();

      if (periodType === "YEAR") {
        fromDate = `${year}-01-01`;
        toDate = `${year}-12-31`;
      } else if (periodType === "QUARTER") {
        const q = Math.floor(now.getMonth() / 3);
        const sm = q * 3 + 1;
        const em = q * 3 + 3;
        const ld = new Date(year, em, 0).getDate();
        fromDate = `${year}-${String(sm).padStart(2, "0")}-01`;
        toDate = `${year}-${String(em).padStart(2, "0")}-${String(ld).padStart(2, "0")}`;
      }

      const res = await fetch(`/v2/api/pnl?from=${fromDate}&to=${toDate}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || `Ошибка ${res.status}`);
        setData(null);
      } else {
        setData(json);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [periodType, fromStr, toStr]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mr-3"></div>
        Загрузка Формы №2...
      </div>
    );
  }

  const L = data?.lines;
  const taxRatePct = data ? Math.round((data.turnoverTaxRate ?? TAX_RATES.TURNOVER_TAX) * 100) : TAX_RATES.TURNOVER_TAX * 100;
  const taxLabel = data?.taxRegime === "VAT" ? "Налог на прибыль (15%)" : `Налог с оборота (${taxRatePct}%)`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Отчёт о финансовых результатах</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Форма №2 (метод начисления)
            {data && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${data.taxRegime === "VAT" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                {data.taxRegime === "VAT" ? "НДС + Налог на прибыль" : `Налог с оборота ${taxRatePct}%`}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-700 w-full md:w-auto">
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

      {loading && data && (
        <div className="text-xs text-gray-400 text-center py-1">Обновление...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700 font-medium">
          Ошибка загрузки: {error}
        </div>
      )}

      {/* Main table */}
      {data && L && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                  <th className="p-3.5 text-center w-12 text-[10px]">Стр.</th>
                  <th className="p-3.5 min-w-[300px]">Наименование показателя</th>
                  <th className="p-3.5 text-right min-w-[160px]">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                <SectionHeader label="Выручка и себестоимость" />
                <Row num="010" label="Чистая выручка от реализации продукции (товаров, услуг)" value={L.line010} alwaysShow />
                <Row num="020" label="Себестоимость реализованной продукции (товаров, услуг)" value={L.line020} indent minus />
                <Row num="030" label="Валовая прибыль (убыток)" value={L.line030} total alwaysShow />

                <SectionHeader label="Расходы периода" />
                <Row num="050" label="Расходы по реализации" value={L.line050} indent minus />
                <Row num="060" label="Административные расходы" value={L.line060} indent minus />
                <Row num="070" label="Прочие операционные расходы" value={L.line070} indent minus />
                <Row num="080" label="Расходы, вычитаемые в будущем периоде" value={L.line080} indent minus />
                <Row num="040" label="Расходы периода, итого" value={L.line040} bold minus />
                <Row num="090" label="Прочие доходы от основной деятельности" value={L.line090} />
                <Row num="100" label="Прибыль (убыток) от основной деятельности" value={L.line100} total alwaysShow />

                <SectionHeader label="Финансовая деятельность" />
                <Row num="110" label="Доходы от финансовой деятельности, итого" value={L.line110} bold />
                <Row num="120" label="в т.ч. дивиденды" value={L.line120} indent />
                <Row num="130" label="в т.ч. проценты" value={L.line130} indent />
                <Row num="140" label="в т.ч. доходы от аренды" value={L.line140} indent />
                <Row num="150" label="в т.ч. курсовые разницы (положительные)" value={L.line150} indent />
                <Row num="160" label="в т.ч. прочие финансовые доходы" value={L.line160} indent />
                <Row num="170" label="Расходы по финансовой деятельности, итого" value={L.line170} bold minus />
                <Row num="180" label="в т.ч. расходы по процентам" value={L.line180} indent minus />
                <Row num="200" label="в т.ч. убытки от курсовых разниц" value={L.line200} indent minus />
                <Row num="210" label="в т.ч. прочие финансовые расходы" value={L.line210} indent minus />

                <Row num="220" label="Прибыль от общехозяйственной деятельности" value={L.line220} total alwaysShow />
                <Row num="230" label="Чрезвычайные прибыли и убытки (±)" value={L.line230} />
                <Row num="240" label="Прибыль до уплаты налога" value={L.line240} total alwaysShow />

                <SectionHeader label="Налоги от прибыли" />
                <Row num="250" label={taxLabel} value={L.line250} indent minus />
                <Row num="260" label="Прочие налоги, исчисляемые от прибыли" value={L.line260} indent minus />

                <Row num="270" label="Чистая прибыль (убыток)" value={L.line270} grandTotal alwaysShow />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Помесячный разрез */}
      {data && data.months.length > 1 && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                  <th className="p-3.5 min-w-[200px]">Показатель</th>
                  {data.months.map((m) => {
                    const [, mo] = m.split("-");
                    return <th key={m} className="p-3.5 text-right whitespace-nowrap">{MONTH_NAMES_RU[mo]}</th>;
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                <tr className="hover:bg-gray-50/50">
                  <td className="p-3.5 font-semibold text-gray-700">Выручка (стр.010)</td>
                  {data.monthlyRevenue.map((v, i) => (
                    <td key={i} className="p-3.5 text-right font-mono">{fmtNum(v)}</td>
                  ))}
                </tr>
                <tr className="bg-gray-100/40 border-t-2 border-gray-200 font-bold">
                  <td className="p-3.5 font-black text-gray-800">Чистая прибыль (стр.270)</td>
                  {data.monthlyNetProfit.map((v, i) => (
                    <td key={i} className={`p-3.5 text-right font-mono font-bold ${v < 0 ? "text-rose-600" : ""}`}>{fmtNum(v)}</td>
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
