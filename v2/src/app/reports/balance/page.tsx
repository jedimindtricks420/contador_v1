"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import ClientLayout from "@/components/Layout/ClientLayout";

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>;
  const val = Math.round(n);
  return <span className={val < 0 ? "text-rose-600" : ""}>{new Intl.NumberFormat("ru-RU").format(Math.abs(val))}</span>;
}

interface BalanceItem { code: string; name: string; type: string; assetValue: number; liabValue: number; }
interface Section { label: string; items: BalanceItem[]; total: number; }

interface BalanceData {
  asOf: string;
  assets: { longTerm: Section; current: Section; total: number };
  liabilitiesAndEquity: { shortTerm: Section; longTerm: Section; equity: Section; currentResult: Section; total: number };
  balanceCheck: boolean;
  difference: number;
}

function SectionBlock({ sec, valueKey }: { sec: Section; valueKey: "assetValue" | "liabValue" }) {
  const [expanded, setExpanded] = useState(false);
  const hasItems = sec.items.length > 0;
  return (
    <div>
      <div
        className={`flex justify-between items-center py-2 px-3 bg-gray-50 border-b border-gray-200 ${hasItems ? "cursor-pointer hover:bg-gray-100" : ""}`}
        onClick={() => hasItems && setExpanded(!expanded)}
      >
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{sec.label}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm font-extrabold text-gray-900">{new Intl.NumberFormat("ru-RU").format(Math.round(Math.abs(sec.total)))}</span>
          {hasItems && <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>}
        </div>
      </div>
      {expanded && (
        <div className="divide-y divide-gray-100">
          {sec.items.map((item) => (
            <div key={item.code} className="flex justify-between items-center py-1.5 px-6 text-xs text-gray-600">
              <span className="font-mono text-gray-400 mr-3">{item.code}</span>
              <span className="flex-1 font-medium">{item.name}</span>
              <span className="font-semibold tabular-nums ml-4">
                {fmt(valueKey === "assetValue" ? item.assetValue : item.liabValue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BalancePage() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [toStr, setToStr] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/v2/api/reports/balance?to=${toStr}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [toStr]);

  return (
    <ClientLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900 uppercase">Бухгалтерский баланс</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Форма №1 — Активы / Обязательства / Капитал</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <span>На дату:</span>
            <input
              type="date"
              value={toStr}
              onChange={(e) => setToStr(e.target.value)}
              className="bg-white border border-gray-200 px-2.5 py-1.5 outline-none focus:border-black"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mr-3"></div>
            Загрузка баланса...
          </div>
        )}

        {!loading && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* АКТИВЫ */}
            <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-black text-white text-xs font-black uppercase tracking-widest px-4 py-2.5">
                АКТИВ
              </div>
              <SectionBlock sec={data.assets.longTerm} valueKey="assetValue" />
              <SectionBlock sec={data.assets.current} valueKey="assetValue" />
              <div className="flex justify-between items-center px-4 py-3 border-t-2 border-black">
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider">ИТОГО АКТИВ</span>
                <span className="text-lg font-black text-gray-900">{new Intl.NumberFormat("ru-RU").format(Math.round(data.assets.total))}</span>
              </div>
            </div>

            {/* ПАССИВЫ */}
            <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-black text-white text-xs font-black uppercase tracking-widest px-4 py-2.5">
                ПАССИВ
              </div>
              <SectionBlock sec={data.liabilitiesAndEquity.shortTerm} valueKey="liabValue" />
              <SectionBlock sec={data.liabilitiesAndEquity.longTerm} valueKey="liabValue" />
              <SectionBlock sec={data.liabilitiesAndEquity.equity} valueKey="liabValue" />
              <SectionBlock sec={data.liabilitiesAndEquity.currentResult} valueKey="liabValue" />
              <div className="flex justify-between items-center px-4 py-3 border-t-2 border-black">
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider">ИТОГО ПАССИВ</span>
                <span className="text-lg font-black text-gray-900">{new Intl.NumberFormat("ru-RU").format(Math.round(data.liabilitiesAndEquity.total))}</span>
              </div>
            </div>
          </div>
        )}

        {!loading && data && (
          <div className={`flex items-center gap-3 p-3 text-xs font-bold rounded border ${data.balanceCheck ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {data.balanceCheck ? (
              <><CheckCircle2 size={14} className="inline mr-1.5 text-green-600" />Баланс сходится: Актив = Пассив</>
            ) : (
              <><AlertTriangle size={14} className="inline mr-1.5" />Расхождение: {new Intl.NumberFormat("ru-RU").format(Math.round(Math.abs(data.difference)))} сум. Проверьте проводки.</>
            )}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
