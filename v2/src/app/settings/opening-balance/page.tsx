"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Plus, Trash2, X } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

interface BalanceLine {
  accountCode: string;
  debit: string;
  credit: string;
}

interface AccountOption {
  code: string;
  name: string;
  type: string;
}

export default function OpeningBalancePage() {
  const [lines, setLines] = useState<BalanceLine[]>([{ accountCode: "", debit: "0", credit: "0" }]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/v2/api/accounts").then(r => r.ok ? r.json() : []),
      fetch("/v2/api/settings/opening-balance").then(r => r.ok ? r.json() : { lines: [] })
    ]).then(([accs, existing]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      if (existing.lines && existing.lines.length > 0) {
        setLines(existing.lines.map((l: any) => ({
          accountCode: l.accountCode,
          debit: String(l.debit || 0),
          credit: String(l.credit || 0)
        })));
      }
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const addLine = () => setLines(prev => [...prev, { accountCode: "", debit: "0", credit: "0" }]);

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, field: keyof BalanceLine, val: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = totalDebit - totalCredit;

  const handleSave = async () => {
    const validLines = lines.filter(l => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length === 0) { setError("Добавьте хотя бы одну строку с суммой"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/v2/api/settings/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          lines: validLines.map(l => ({ accountCode: l.accountCode, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 }))
        })
      });
      if (res.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
      else { const e = await res.json(); setError(e.error || "Ошибка сохранения"); }
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Начальные остатки</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Введите остатки по счетам на начало ведения учёта. Разница балансируется на счёт 8890.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto"><X size={13} /></button>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800 font-semibold">
                <CheckCircle2 size={13} />
                Начальные остатки сохранены!
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-500 w-32">Дата остатков</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-white border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 outline-hidden focus:border-black"
              />
            </div>

            {/* Lines table */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Счёт</th>
                    <th className="py-3 px-4 text-right">Дебет</th>
                    <th className="py-3 px-4 text-right">Кредит</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/40">
                      <td className="py-2 px-4">
                        <SearchableSelect
                          options={accounts.map(a => ({ value: a.code, label: `${a.code} — ${a.name}`, searchText: a.code }))}
                          value={line.accountCode}
                          onChange={v => updateLine(idx, "accountCode", v)}
                          placeholder="— Выберите счёт —"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={e => updateLine(idx, "debit", e.target.value)}
                          className="w-full text-right bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-mono text-gray-700 outline-hidden focus:border-black"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={e => updateLine(idx, "credit", e.target.value)}
                          className="w-full text-right bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-mono text-gray-700 outline-hidden focus:border-black"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => removeLine(idx)}
                          className="text-gray-300 hover:text-rose-500 transition p-1 rounded"
                          disabled={lines.length === 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200 font-bold text-xs">
                    <td className="py-2 px-4 text-gray-500">Итого</td>
                    <td className="py-2 px-4 text-right font-mono">{totalDebit.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-4 text-right font-mono">{totalCredit.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                  {diff !== 0 && (
                    <tr className="bg-amber-50 border-t border-amber-200 text-xs">
                      <td className="py-2 px-4 text-amber-700 font-semibold" colSpan={4}>
                        Разница {Math.abs(diff).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} будет отнесена на счёт 8890 (нераспределённая прибыль)
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={addLine}
                className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded transition"
              >
                <Plus size={12} /> Добавить строку
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition disabled:opacity-40"
              >
                {saving ? "Сохранение..." : "Сохранить начальные остатки"}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
