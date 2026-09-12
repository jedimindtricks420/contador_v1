"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Plus, Trash2, X } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { isOpeningBalanceAccount, openingBalanceSchema, openingBalanceTotals } from "@/lib/openingBalanceInput";

interface BalanceLine {
  accountCode: string;
  debit: string;
  credit: string;
}

interface AccountOption {
  code: string;
  name: string;
  type: string;
  isDeprecated: boolean;
  children?: AccountOption[];
}

function flattenAccounts(accounts: AccountOption[]): AccountOption[] {
  return accounts.flatMap(account => [account, ...flattenAccounts(account.children ?? [])]);
}

export default function OpeningBalancePage() {
  const [lines, setLines] = useState<BalanceLine[]>([{ accountCode: "", debit: "0", credit: "0" }]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    async function load(url: string) {
      const response = await fetch(url, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить начальные остатки");
      return data;
    }
    Promise.all([
      load("/v2/api/accounts"),
      load("/v2/api/settings/opening-balance")
    ]).then(([accs, existing]) => {
      if (!active) return;
      if (!Array.isArray(accs) || !Array.isArray(existing.lines)) throw new Error("Некорректный ответ сервера");
      setAccounts(flattenAccounts(accs).filter(account => isOpeningBalanceAccount({ ...account, _count: { children: account.children?.length ?? 0 } })));
      if (existing.lines && existing.lines.length > 0) {
        setLines(existing.lines.map((line: BalanceLine) => ({
          accountCode: line.accountCode,
          debit: String(line.debit),
          credit: String(line.credit)
        })));
      }
      if (existing.date) setDate(existing.date);
      setReadOnly(Boolean(existing.documentId));
      setReady(true);
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : "Ошибка загрузки");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [reload]);

  const addLine = () => setLines(prev => [...prev, { accountCode: "", debit: "0", credit: "0" }]);

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, field: keyof BalanceLine, val: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const totals = openingBalanceTotals(lines.map(line => ({
    debit: /^\d{1,18}(?:\.\d{1,2})?$/.test(line.debit) ? line.debit : "0",
    credit: /^\d{1,18}(?:\.\d{1,2})?$/.test(line.credit) ? line.credit : "0",
  })));
  const balanced = totals.debit === totals.credit;

  const handleSave = async () => {
    if (!ready || readOnly || saving) return;
    const parsed = openingBalanceSchema.safeParse({ date, lines });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Проверьте суммы и счета"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/v2/api/settings/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) { setSuccess(true); setReadOnly(true); }
      else { const e = await res.json(); setError(e.error || "Ошибка сохранения"); }
    } catch (error) {
      setError(error instanceof Error ? `${error.message}. Проверьте состояние сохранения после обновления страницы.` : "Ошибка сохранения");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Начальные остатки</h1>
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

            {!ready && (
              <button onClick={() => { setError(null); setLoading(true); setReload(value => value + 1); }} className="text-sm underline">Повторить загрузку</button>
            )}
            {readOnly && <p className="text-xs text-gray-500">Проведённый начальный баланс</p>}
            <fieldset disabled={!ready || readOnly || saving} className="space-y-4 min-w-0">
            <div className="flex items-center gap-3">
              <label htmlFor="opening-date" className="text-xs font-bold text-gray-500 w-32">Дата остатков</label>
              <input
                id="opening-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-white border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 outline-hidden focus:border-black"
              />
            </div>

            <div className="border border-gray-200 rounded overflow-x-auto">
              <table className="w-full min-w-[540px] text-left border-collapse text-xs">
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
                        {readOnly ? <span>{line.accountCode}</span> : <SearchableSelect
                          options={accounts.map(a => ({ value: a.code, label: `${a.code} — ${a.name}`, searchText: a.code }))}
                          value={line.accountCode}
                          onChange={v => updateLine(idx, "accountCode", v)}
                          placeholder="— Выберите счёт —"
                        />}
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Дебет строки ${idx + 1}`}
                          value={line.debit}
                          onChange={e => updateLine(idx, "debit", e.target.value)}
                          className="w-full text-right bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-mono text-gray-700 outline-hidden focus:border-black"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Кредит строки ${idx + 1}`}
                          value={line.credit}
                          onChange={e => updateLine(idx, "credit", e.target.value)}
                          className="w-full text-right bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-mono text-gray-700 outline-hidden focus:border-black"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          title="Удалить строку"
                          aria-label={`Удалить строку ${idx + 1}`}
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
                    <td className="py-2 px-4 text-right font-mono">{totals.debit}</td>
                    <td className="py-2 px-4 text-right font-mono">{totals.credit}</td>
                    <td></td>
                  </tr>
                  {!balanced && (
                    <tr className="bg-amber-50 border-t border-amber-200 text-xs">
                      <td className="py-2 px-4 text-amber-700 font-semibold" colSpan={4}>
                        Дебет и кредит не совпадают
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {!readOnly && <div className="flex flex-wrap gap-3 items-center justify-between">
              <button
                onClick={addLine}
                className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded transition"
              >
                <Plus size={12} /> Добавить строку
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !ready || !balanced}
                className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition disabled:opacity-40"
              >
                {saving ? "Сохранение..." : "Сохранить начальные остатки"}
              </button>
            </div>}
            </fieldset>
          </div>
        )}
    </div>
  );
}
