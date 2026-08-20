"use client";
import { Fragment, useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

// Дашборд «Расчёт налога на прибыль» — зеркало формы my.soliq.uz (ТЗ, раздел 5).
// Цветовая логика портала: жёлтый = «Contador посчитал сам» (вычисляемая ячейка),
// циан = «проверить/ввести вручную перед переносом на портал».

interface FormLine { code: string; label: string; amount: number; kind: "computed" | "manual"; indent?: number }
interface Ap2Line { code: string; label: string; col3: number; col4: number; kind: "computed" | "manual"; indent?: number }
interface AppendixStatusItem { code: string; title: string; status: string; note: string }
interface LineDetail {
  documentId: string; date: string; docTypeCode: string; docTypeName: string;
  counterparty: string | null; accountCode: string; amount: number;
  nonDeductible: boolean; override: boolean | null;
}

interface Report {
  meta: {
    orgName: string; inn: string | null; year: number; quarter: number;
    periodFrom: string; periodTo: string; isAnnual: boolean;
    taxRatePct: number; taxBenefit: string; benefitActive: boolean;
    costingMethod: "PROPORTIONAL" | "DIRECT" | null;
    avgHeadcount: number; avgHeadcountDisabled: number; generatedAt: string;
  };
  appendix1: { lines: FormLine[]; total010: number };
  appendix2: { lines: Ap2Line[]; total010: { col3: number; col4: number }; deductible: number };
  mainForm: { lines: FormLine[]; values: Record<string, number> };
  appendixStatuses: AppendixStatusItem[];
  warnings: string[];
}

const fmtN = (n: number) => {
  const v = Math.round(n * 100) / 100;
  if (v === 0) return "—";
  const s = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Math.abs(v));
  return v < 0 ? `(${s})` : s;
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  FILLED: { label: "Заполнено", cls: "bg-green-100 text-green-700" },
  NOT_APPLICABLE: { label: "Не применимо (0)", cls: "bg-gray-100 text-gray-500" },
  NEEDS_DATA: { label: "Требует проверки", cls: "bg-amber-100 text-amber-700" },
  ANNUAL_ONLY: { label: "Только годовой отчёт", cls: "bg-blue-100 text-blue-600" },
};

const METHOD_LABEL: Record<string, string> = {
  PROPORTIONAL: "пропорциональный",
  DIRECT: "прямой",
};

function Card({ title, value, accent, note }: { title: string; value: number; accent?: "pos" | "neg" | "warn"; note?: string }) {
  const color = accent === "neg" ? "text-rose-600" : accent === "warn" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{title}</div>
      <div className={`mt-1 text-lg font-black font-mono tabular-nums ${color}`}>{fmtN(value)}</div>
      {note && <div className="mt-0.5 text-[10px] text-gray-400">{note}</div>}
    </div>
  );
}

// Ячейка суммы с цветовой маркировкой портала
function ValCell({ amount, kind, strong }: { amount: number; kind: "computed" | "manual"; strong?: boolean }) {
  const bg = kind === "computed" ? "bg-amber-50" : "bg-cyan-50";
  return (
    <td className={`p-2.5 text-right font-mono tabular-nums text-xs ${bg} ${strong ? "font-black" : "font-medium"}`}>
      {fmtN(amount)}
    </td>
  );
}

export default function TaxDashboardClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [openLine, setOpenLine] = useState<string | null>(null); // "APPENDIX_2|0111"
  const [details, setDetails] = useState<Record<string, LineDetail[]>>({});
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/v2/api/reports/profit-tax?year=${year}&quarter=${quarter}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || `Ошибка ${res.status}`);
        setData(null);
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOpenLine(null);
    setDetails({});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, quarter]);

  const toggleDetails = async (appendix: "APPENDIX_1" | "APPENDIX_2", line: string) => {
    const key = `${appendix}|${line}`;
    if (openLine === key) { setOpenLine(null); return; }
    setOpenLine(key);
    if (!details[key]) {
      setDetailsLoading(key);
      try {
        const res = await fetch(`/v2/api/reports/profit-tax/line-details?year=${year}&quarter=${quarter}&appendix=${appendix}&line=${line}`);
        const json = await res.json();
        setDetails(prev => ({ ...prev, [key]: json.details ?? [] }));
      } catch {
        setDetails(prev => ({ ...prev, [key]: [] }));
      } finally {
        setDetailsLoading(null);
      }
    }
  };

  const M = data?.mainForm.values;
  const line150 = M?.["150"] ?? 0;

  const DetailsRow = ({ appendix, line, colSpan }: { appendix: "APPENDIX_1" | "APPENDIX_2"; line: string; colSpan: number }) => {
    const key = `${appendix}|${line}`;
    if (openLine !== key) return null;
    const rows = details[key];
    return (
      <tr className="bg-gray-50/80 print:hidden">
        <td colSpan={colSpan} className="p-3">
          {detailsLoading === key && <div className="text-xs text-gray-400">Загрузка расшифровки...</div>}
          {rows && rows.length === 0 && detailsLoading !== key && (
            <div className="text-xs text-gray-400">Нет документов по этой строке за период.</div>
          )}
          {rows && rows.length > 0 && (
            <table className="w-full text-[11px] border border-gray-200 rounded">
              <thead>
                <tr className="bg-white text-gray-400 font-semibold border-b border-gray-200">
                  <th className="p-2 text-left">Дата</th>
                  <th className="p-2 text-left">Документ</th>
                  <th className="p-2 text-left">Контрагент</th>
                  <th className="p-2 text-center">Счёт</th>
                  <th className="p-2 text-right">Сумма</th>
                  <th className="p-2 text-center">Вычитаемость</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="p-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString("ru-RU")}</td>
                    <td className="p-2">{r.docTypeName}</td>
                    <td className="p-2">{r.counterparty ?? "—"}</td>
                    <td className="p-2 text-center font-mono">{r.accountCode}</td>
                    <td className="p-2 text-right font-mono">{fmtN(r.amount)}</td>
                    <td className="p-2 text-center">
                      {appendix === "APPENDIX_1" ? "—" : r.nonDeductible
                        ? <span className="text-rose-600 font-semibold">невычитаемый{r.override === false ? " (переопределено)" : ""}</span>
                        : <span className="text-green-700">вычитаемый{r.override === true ? " (переопределено)" : ""}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Расчёт налога на прибыль</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Зеркало формы my.soliq.uz (отчёт 10205_47), нарастающим итогом с начала года
            {data?.meta.costingMethod && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                метод себестоимости: {METHOD_LABEL[data.meta.costingMethod]}
              </span>
            )}
            {data?.meta.benefitActive && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                льгота IT Park — ставка 0%
              </span>
            )}
          </p>
          <p className="text-[10px] text-gray-300 mt-1">
            <span className="inline-block w-2.5 h-2.5 bg-amber-50 border border-amber-200 rounded-sm align-middle mr-1"></span>
            посчитано автоматически
            <span className="inline-block w-2.5 h-2.5 bg-cyan-50 border border-cyan-200 rounded-sm align-middle ml-3 mr-1"></span>
            проверить/ввести вручную
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-gray-700">
          <SearchableSelect
            options={Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i).map(y => ({ value: String(y), label: String(y) }))}
            value={String(year)}
            onChange={v => setYear(Number(v))}
          />
          <SearchableSelect
            options={[
              { value: "1", label: "I квартал" },
              { value: "2", label: "II квартал (полугодие)" },
              { value: "3", label: "III квартал (9 месяцев)" },
              { value: "4", label: "IV квартал (год)" },
            ]}
            value={String(quarter)}
            onChange={v => setQuarter(Number(v))}
          />
          <button
            onClick={() => window.print()}
            className="bg-gray-900 text-white rounded px-3 py-1.5 font-semibold hover:bg-gray-700"
          >
            Экспорт формы
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center h-[300px] text-gray-500 font-medium print:hidden">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mr-3"></div>
          Расчёт налога на прибыль...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700 font-medium print:hidden">
          Ошибка: {error}
        </div>
      )}

      {data && (
        <>
          {/* Шапка печатной формы */}
          <div className="hidden print:block text-center mb-4">
            <div className="text-sm font-black">Расчёт налога на прибыль юридических лиц</div>
            <div className="text-xs mt-1">
              {data.meta.orgName}{data.meta.inn ? ` · ИНН ${data.meta.inn}` : ""} · {data.meta.year} год,
              {" "}{["I квартал", "полугодие", "9 месяцев", "год"][data.meta.quarter - 1]} · единица измерения: сум
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Сформировано Contador {new Date(data.meta.generatedAt).toLocaleString("ru-RU")} — для сверки перед вводом на my.soliq.uz
            </div>
          </div>

          {/* Предупреждения */}
          {data.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-1 print:hidden">
              {data.warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-800 font-medium">⚠ {w}</div>
              ))}
            </div>
          )}

          {/* Верхний блок — карточки */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
            <Card title="Совокупный доход" value={M?.["010"] ?? 0} />
            <Card title="Вычитаемые расходы" value={M?.["020"] ?? 0} />
            <Card title="Налоговая база" value={M?.["062"] ?? 0} />
            <Card title={`Налог по ставке ${data.meta.taxRatePct}%`} value={M?.["080"] ?? 0} note="предварительно, до подтверждения" accent="warn" />
            <Card title="Начислено авансом" value={M?.["090"] ?? 0} />
            <Card
              title={line150 >= 0 ? "К доплате за квартал" : "К возврату / переплата"}
              value={Math.abs(line150)}
              accent={line150 >= 0 ? "neg" : "pos"}
            />
          </div>

          {/* Основная форма 010–150 */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 bg-gray-50 text-xs font-black text-gray-700">
              Основная форма — строки 010–150 (заполняется нарастающим итогом)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                    <th className="p-2.5 text-center w-14 text-[10px]">Код</th>
                    <th className="p-2.5 min-w-[340px]">Показатели</th>
                    <th className="p-2.5 text-right min-w-[150px]">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {data.mainForm.lines.map(l => (
                    <tr key={l.code} className="hover:bg-gray-50/50">
                      <td className="p-2.5 text-center text-[10px] font-mono text-gray-400">{l.code}</td>
                      <td className={`p-2.5 text-xs text-gray-700 ${["030", "062", "080", "150"].includes(l.code) ? "font-black" : ""}`}>{l.label}</td>
                      <ValCell amount={l.amount} kind={l.kind} strong={["030", "062", "080", "150"].includes(l.code)} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Приложение №1 */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 bg-gray-50 text-xs font-black text-gray-700">
              Приложение №1 — Совокупный доход
              <span className="ml-2 font-medium text-gray-400 print:hidden">(клик по строке — расшифровка по документам)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                    <th className="p-2.5 text-center w-14 text-[10px]">Код</th>
                    <th className="p-2.5 min-w-[340px]">Перечень совокупного дохода</th>
                    <th className="p-2.5 text-right min-w-[150px]">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {data.appendix1.lines.filter(l => l.amount !== 0 || ["010", "020", "050", "130", "090", "280"].includes(l.code)).map(l => (
                    <Fragment key={l.code}>
                      <tr
                        className={`hover:bg-gray-50/50 ${l.code !== "010" ? "cursor-pointer print:cursor-auto" : ""}`}
                        onClick={() => l.code !== "010" && toggleDetails("APPENDIX_1", l.code)}>
                        <td className="p-2.5 text-center text-[10px] font-mono text-gray-400">{l.code}</td>
                        <td className={`p-2.5 text-xs text-gray-700 ${l.code === "010" ? "font-black" : ""} ${l.indent === 1 ? "pl-8" : l.indent === 2 ? "pl-12" : ""}`}>
                          {l.label}
                        </td>
                        <ValCell amount={l.amount} kind={l.kind} strong={l.code === "010"} />
                      </tr>
                      <DetailsRow appendix="APPENDIX_1" line={l.code} colSpan={3} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Приложение №2 */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 bg-gray-50 text-xs font-black text-gray-700">
              Приложение №2 — Расходы (убытки) по данным налогового учёта{data.meta.isAnnual ? " (в годовом отчёте — Приложение №2.1, коды 0301–0334)" : ""}
              <span className="ml-2 font-medium text-gray-400 print:hidden">(клик по строке — расшифровка по документам)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-bold">
                    <th className="p-2.5 text-center w-14 text-[10px]">Код</th>
                    <th className="p-2.5 min-w-[300px]">Перечень расходов (убытков)</th>
                    <th className="p-2.5 text-right min-w-[130px]">Расходы (гр. 3)</th>
                    <th className="p-2.5 text-right min-w-[130px]">из них невычитаемые (гр. 4)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {data.appendix2.lines.filter(l => l.col3 !== 0 || l.col4 !== 0 || ["010", "020", "030"].includes(l.code)).map(l => (
                    <Fragment key={l.code}>
                      <tr
                        className={`hover:bg-gray-50/50 ${l.code !== "010" ? "cursor-pointer print:cursor-auto" : ""} ${l.code === "010" ? "bg-gray-50/50" : ""}`}
                        onClick={() => l.code !== "010" && toggleDetails("APPENDIX_2", l.code)}>
                        <td className="p-2.5 text-center text-[10px] font-mono text-gray-400">{l.code}</td>
                        <td className={`p-2.5 text-xs text-gray-700 ${l.code === "010" ? "font-black" : ""} ${l.indent ? "pl-8" : ""}`}>{l.label}</td>
                        <ValCell amount={l.col3} kind={l.kind} strong={l.code === "010"} />
                        <ValCell amount={l.col4} kind={l.kind} strong={l.code === "010"} />
                      </tr>
                      <DetailsRow appendix="APPENDIX_2" line={l.code} colSpan={4} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-gray-100 text-[11px] text-gray-500">
              Вычитаемые расходы (графа 3 − графа 4 строки 010): <span className="font-black font-mono">{fmtN(data.appendix2.deductible)}</span>
              {" "}→ строка 020 основной формы
            </div>
          </div>

          {/* Нижний блок — статус готовности отчёта */}
          <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 bg-gray-50 text-xs font-black text-gray-700">
              Статус готовности отчёта — чек-лист приложений
            </div>
            <div className="divide-y divide-gray-100">
              {data.appendixStatuses.map(a => {
                const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.NOT_APPLICABLE;
                return (
                  <div key={a.code} className="flex items-start gap-3 p-3">
                    <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    <div>
                      <div className="text-xs font-semibold text-gray-800">{a.title}</div>
                      <div className="text-[11px] text-gray-400">{a.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
