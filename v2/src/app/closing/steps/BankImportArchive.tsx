"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

interface Batch {
  id: string;
  sourceName: string;
  bankCurrency: string;
  status: string;
  createdAt: string;
}

export default function BankImportArchive({ bankAccountId }: { bankAccountId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ batches: [] as Batch[], nextCursor: null as string | null, loading: true, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const query = new URLSearchParams({ bankAccountId });
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(`/v2/api/import/bank/batches?${query}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить архив");
        if (!Array.isArray(result.batches) || (result.nextCursor !== null && typeof result.nextCursor !== "string")) {
          throw new Error("Некорректный ответ архива");
        }
        if (controller.signal.aborted) return;
        setState(previous => ({ batches: cursor ? [...previous.batches, ...result.batches] : result.batches,
          nextCursor: result.nextCursor, loading: false, error: "" }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Не удалось загрузить архив" }));
      }
    }
    void load();
    return () => controller.abort();
  }, [bankAccountId, cursor, retry]);

  return <section aria-label="Архив банковских выписок" className="border-t border-gray-200 pt-4 space-y-3">
    <h3 className="text-sm font-semibold text-gray-800">Архив банковских выписок</h3>
    {state.batches.length > 0 && <ul className="divide-y divide-gray-100">
      {state.batches.map(batch => <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1 basis-48">
          <div className="text-xs font-medium break-all">{batch.sourceName}</div>
          <div className="text-xs text-gray-500 mt-1">
            {new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" }).format(new Date(batch.createdAt))}
            {" · "}{batch.bankCurrency}{" · "}{batch.status === "ROLLED_BACK" ? "Импорт отменён" : batch.status === "IMPORTED" ? "Импортирована" : batch.status}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <a href={`/v2/api/import/bank/batches/${encodeURIComponent(batch.id)}/export?format=source`} download
            className="inline-flex items-center gap-1 underline" title={`Оригинал: ${batch.sourceName}`}><Download size={14} />Оригинал</a>
          <a href={`/v2/api/import/bank/batches/${encodeURIComponent(batch.id)}/export?format=protocol`} download
            className="inline-flex items-center gap-1 underline" title={`Протокол: ${batch.sourceName}`}><Download size={14} />Протокол</a>
        </div>
      </li>)}
    </ul>}
    {!state.loading && !state.error && state.batches.length === 0 && <p className="text-xs text-gray-500">Сохранённых партий нет</p>}
    {state.loading && <p role="status" className="text-xs text-gray-500">Загрузка архива...</p>}
    {state.error && <div role="alert" className="text-xs text-red-700 space-y-2">
      <p>{state.error}</p>
      <button type="button" disabled={state.loading} className="inline-flex items-center gap-1 underline" onClick={() => {
        setState(previous => ({ ...previous, loading: true, error: "" }));
        setRetry(previous => previous + 1);
      }}><RefreshCw size={14} />Повторить загрузку архива</button>
    </div>}
    {state.nextCursor && !state.error && <button type="button" disabled={state.loading} className="text-xs underline disabled:opacity-50" onClick={() => {
      setState(previous => ({ ...previous, loading: true, error: "" }));
      setCursor(state.nextCursor);
    }}>Загрузить ещё</button>}
  </section>;
}