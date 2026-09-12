"use client";
import { useEffect, useRef, useState } from "react";
import { BarChart2, Check, AlertTriangle, FolderOpen, X, RefreshCw, Download, FileJson } from "lucide-react";
import { formatSum } from "@/lib/format";
import SearchableSelect from "@/components/SearchableSelect";

interface Step6SoliqProps {
  periodId: string;
  onNext: (payload: any) => void;
  onPrev: () => void;
  initialSoliqMatched: {
    matched: number;
    unmatched: number;
  };
}

function BatchExports({ batchId }: { batchId: string }) {
  const url = `/v2/api/import/soliq/${encodeURIComponent(batchId)}/export`;
  return <span className="flex shrink-0 items-center gap-1">
    <a href={`${url}?format=source`} download title="Скачать оригинал" aria-label="Скачать оригинал"
      className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100">
      <Download size={16} />
    </a>
    <a href={`${url}?format=protocol`} download title="Скачать протокол" aria-label="Скачать протокол"
      className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100">
      <FileJson size={16} />
    </a>
  </span>;
}

export default function Step6Soliq(props: Step6SoliqProps) {
  return <SoliqPeriodStep key={props.periodId} {...props} />;
}

function SoliqPeriodStep({ periodId, onNext, onPrev }: Step6SoliqProps) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const [soliqFile, setSoliqFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<any | null>(null);
  const [reconciliationFileName, setReconciliationFileName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pendingBatches, setPendingBatches] = useState<{ id: string; sourceName: string }[]>([]);
  const [archives, setArchives] = useState<{ id: string; sourceName: string; status: string }[]>([]);
  const [imported, setImported] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [discardReason, setDiscardReason] = useState<string | null>(null);
  const busy = saving || uploading || aiMatching || pendingLoading;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/v2/api/import/soliq?periodId=${encodeURIComponent(periodId)}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось получить пакеты Soliq");
        if (!controller.signal.aborted) {
          setPendingBatches(result.batches);
          setArchives(result.archives ?? []);
          setImported(result.imported === true);
          setPendingError(null);
        }
      })
      .catch(error => { if (!controller.signal.aborted) setPendingError(error.message || "Ошибка сети"); })
      .finally(() => { if (!controller.signal.aborted) setPendingLoading(false); });
    return () => controller.abort();
  }, [periodId, reloadCount]);

  const handleResume = async (batchId: string) => {
    if (busy) return;
    setUploading(true);
    setUploadError(null);
    try {
      const response = await fetch(`/v2/api/import/soliq?periodId=${encodeURIComponent(periodId)}&batchId=${encodeURIComponent(batchId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReconciliation(result);
      setReconciliationFileName(result.sourceName);
      setSaveError(null);
      setAiError(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setUploading(false);
    }
  };

  const handleDiscard = async () => {
    if (busy || !reconciliation || !discardReason?.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/v2/api/import/soliq/${encodeURIComponent(reconciliation.batchId)}/discard`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: discardReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPendingBatches(current => current.filter(batch => batch.id !== reconciliation.batchId));
      setArchives(current => [{ id: reconciliation.batchId, sourceName: reconciliationFileName, status: "CANCELLED" }, ...current]);
      setReconciliation(null);
      setReconciliationFileName("");
      setSoliqFile(null);
      setDiscardReason(null);
      setAiError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!soliqFile || busy || imported) return;
    setUploading(true);
    setUploadError(null);
    setSaveError(null);
    setAiError(null);
    try {
      const fd = new FormData();
      fd.append("file", soliqFile);
      fd.append("periodId", periodId);

      const res = await fetch("/v2/api/import/soliq", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        setReconciliation(data);
        setReconciliationFileName(data.sourceName);
        setPendingBatches(current => current.some(batch => batch.id === data.batchId) ? current :
          [...current, { id: data.batchId, sourceName: data.sourceName }]);
        setSoliqFile(null);
      } else {
        setUploadError(`Ошибка импорта: ${data.error}`);
      }
    } catch {
      setUploadError("Ошибка сети. Попробуйте снова.");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (busy || discardReason !== null || (!reconciliation && (pendingError || pendingBatches.length > 0))) return;
    if (imported) {
      if (!reconciliation) onNext({});
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = reconciliation ? {
        batchId: reconciliation.batchId,
        decisions: reconciliation.esfItems.map((row: any) => ({
          rowId: row.rowId,
          openItemId: row.matchedOpenItemId ?? null,
          ...(row.receiptKind ? { receiptKind: row.receiptKind } : {}),
        })),
      } : { skip: true };

      const res = await fetch(`/v2/api/closing/${periodId}/step/6/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        if (active.current) onNext({ soliqMatched: result.summary.soliqMatched });
      } else {
        const err = await res.json();
        setSaveError(`Ошибка сохранения: ${err.error}`);
      }
    } catch {
      setSaveError("Ошибка сети. Попробуйте снова.");
    } finally {
      setSaving(false);
    }
  };

  const handleManualMatch = (bankId: string, soliqId: string) => {
    const newReconciliation = structuredClone(reconciliation);

    const bankItemIndex = newReconciliation.bankOnly.findIndex((b: any) => b.id === bankId);
    const soliqItemIndex = newReconciliation.soliqOnly.findIndex((s: any) => s.id === soliqId);
    if (bankItemIndex < 0 || soliqItemIndex < 0) return;

    const bankItem = newReconciliation.bankOnly[bankItemIndex];
    const soliqItem = newReconciliation.soliqOnly[soliqItemIndex];

    const esfPayloadItem = newReconciliation.esfItems.find((row: any) => row.rowId === soliqId);
    if (!esfPayloadItem) return;
    esfPayloadItem.matchStatus = "MATCHED";
    esfPayloadItem.matchedOpenItemId = bankId;

    newReconciliation.matches.push({
      counterpartyName: `${bankItem.counterpartyName} ⟷ ${soliqItem.counterpartyName}`,
      amount: bankItem.amount
    });

    newReconciliation.bankOnly.splice(bankItemIndex, 1);
    newReconciliation.soliqOnly.splice(soliqItemIndex, 1);
    newReconciliation.matched++;
    newReconciliation.unmatched = Math.max(0, newReconciliation.unmatched - 1);

    setReconciliation(newReconciliation);
  };

  const handleAiMatch = async () => {
    if (!reconciliation || reconciliation.bankOnly.length === 0 || reconciliation.soliqOnly.length === 0) return;

    setAiMatching(true);
    setAiError(null);
    try {
      const res = await fetch("/v2/api/classification/ai-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankOnly: reconciliation.bankOnly,
          soliqOnly: reconciliation.soliqOnly
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || `Ошибка ИИ-сверки (${res.status})`);
        return;
      }
      if (res.ok && data.matches && data.matches.length > 0) {
        const newReconciliation = structuredClone(reconciliation);
        
        data.matches.forEach((match: any) => {
          const bankItemIndex = newReconciliation.bankOnly.findIndex((b: any) => b.id === match.bankId);
          const soliqItemIndex = newReconciliation.soliqOnly.findIndex((s: any) => s.id === match.soliqId);
          
          if (bankItemIndex >= 0 && soliqItemIndex >= 0) {
            const bankItem = newReconciliation.bankOnly[bankItemIndex];
            const soliqItem = newReconciliation.soliqOnly[soliqItemIndex];

            const esfPayloadItem = newReconciliation.esfItems.find((row: any) => row.rowId === match.soliqId);
            if (!esfPayloadItem || bankItem.inn !== esfPayloadItem.inn ||
              bankItem.amount !== soliqItem.amount ||
              bankItem.accountCode !== (esfPayloadItem.direction === "REVENUE" ? "6310" : "4310") ||
              new Date(bankItem.date) > new Date(esfPayloadItem.date)) return;
            esfPayloadItem.matchStatus = "MATCHED";
            esfPayloadItem.matchedOpenItemId = match.bankId;

            // Move to matches
            newReconciliation.matches.push({
              counterpartyName: `${bankItem.counterpartyName} ⚡ ${soliqItem.counterpartyName}`,
              amount: bankItem.amount
            });

            // Remove from unmatched
            newReconciliation.bankOnly.splice(bankItemIndex, 1);
            newReconciliation.soliqOnly.splice(soliqItemIndex, 1);

            // Update counts
            newReconciliation.matched++;
            newReconciliation.unmatched = Math.max(0, newReconciliation.unmatched - 1);
          }
        });
        
        setReconciliation(newReconciliation);
      }
    } catch (err: any) {
      console.error("AI Match error:", err);
      setAiError(err?.message || "Ошибка сети при ИИ-сверке");
    } finally {
      setAiMatching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 6. Сверка с порталом my.soliq.uz</h2>
      </div>

      {pendingLoading && <p className="text-xs text-gray-500" role="status">Загрузка пакетов Soliq...</p>}
      {imported && <p className="flex items-center gap-1 text-xs text-gray-700" role="status"><Check size={14} />Реестр уже проведён.</p>}
      {pendingError && <div role="alert" className="flex items-center gap-2 text-xs text-rose-800">
        <span>{pendingError}</span>
        <button type="button" title="Повторить загрузку" aria-label="Повторить загрузку" disabled={busy}
          onClick={() => { setPendingLoading(true); setReloadCount(value => value + 1); }}>
          <RefreshCw size={16} />
        </button>
      </div>}
      {!reconciliation && pendingBatches.length > 0 && <section className="max-w-2xl space-y-2">
        <h3 className="text-xs font-semibold text-gray-700">Непроведённые пакеты</h3>
        <ul className="divide-y divide-gray-200">
          {pendingBatches.map(batch => <li key={batch.id} className="flex items-center gap-3 py-2 text-xs">
            <span className="min-w-0 flex-1 break-all">{batch.sourceName}</span>
            <BatchExports batchId={batch.id} />
            <button type="button" onClick={() => handleResume(batch.id)} disabled={busy}
              className="flex shrink-0 items-center gap-1 text-gray-700 disabled:opacity-50">
              <FolderOpen size={16} /> Открыть
            </button>
          </li>)}
        </ul>
      </section>}

      {!reconciliation && archives.length > 0 && <section className="max-w-2xl border-y border-gray-200 py-3">
        <h3 className="text-xs font-semibold text-gray-700">Архив реестров</h3>
        <ul className="divide-y divide-gray-100">
          {archives.map(batch => <li key={batch.id} className="flex items-center gap-2 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="break-all">{batch.sourceName}</div>
              <div className="mt-1 text-gray-500">{batch.status === "POSTED" ? "Проведён" : "Отменён"}</div>
            </div>
            <BatchExports batchId={batch.id} />
          </li>)}
        </ul>
      </section>}

      {/* Upload Zone */}
      {!reconciliation && !imported && (
        <div className="bg-gray-50/20 border border-gray-200 rounded p-5 space-y-4 max-w-xl">
          <div className="border-2 border-dashed border-gray-200 hover:border-gray-200 rounded p-6 text-center transition duration-200">
            <input
              type="file"
              id="wizardSoliqFile"
              accept=".xlsx,.xls,.xltx"
              disabled={busy}
              onChange={(e) => setSoliqFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <label htmlFor="wizardSoliqFile" className="cursor-pointer space-y-1 block">
              <BarChart2 className="h-7 w-7 text-gray-400 mx-auto" />
              <div className="text-sm font-semibold text-gray-750">
                {soliqFile ? soliqFile.name : "Выберите файл отчета Soliq"}
              </div>
              <div className="text-[10px] text-gray-400">
                Поддерживаются реестры ЭСФ в формате Excel (.xlsx)
              </div>
            </label>
          </div>

          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
              {uploadError}
            </div>
          )}

          {soliqFile && (
            <button
              onClick={handleUpload}
              disabled={busy || !!pendingError}
              className="w-full bg-black hover:opacity-80 text-white text-xs font-bold py-2.5 rounded transition disabled:opacity-50"
            >
              {uploading ? "Сверка данных..." : "Запустить сверку ЭСФ"}
            </button>
          )}
        </div>
      )}

      {/* Reconciliation table */}
      {reconciliation && (
        <div className="space-y-4">
          {/* File info + replace button */}
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-2xl">
            <div className="min-w-0 break-all text-xs text-gray-500 font-medium">
              Файл: <span className="font-semibold text-gray-700">{reconciliationFileName}</span>
            </div>
            <BatchExports batchId={reconciliation.batchId} />
            <button
              onClick={() => setDiscardReason("")}
              disabled={busy || discardReason !== null}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 py-1 font-semibold transition shrink-0 disabled:opacity-50"
            >
              <X size={14} /> Отменить пакет
            </button>
          </div>
          {discardReason !== null && <div className="max-w-2xl space-y-2 border-y border-gray-200 py-3">
            <label htmlFor="soliqDiscardReason" className="block text-xs font-semibold text-gray-700">Причина отмены</label>
            <textarea id="soliqDiscardReason" maxLength={1000} value={discardReason} disabled={busy}
              onChange={event => setDiscardReason(event.target.value)} rows={2}
              className="w-full rounded border border-gray-300 p-2 text-sm" />
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleDiscard} disabled={busy || !discardReason.trim()}
                className="flex items-center gap-1 text-xs font-semibold text-rose-700 disabled:opacity-50">
                <X size={14} /> Подтвердить отмену
              </button>
              <button type="button" onClick={() => setDiscardReason(null)} disabled={busy}
                className="text-xs text-gray-600">Вернуться к сверке</button>
            </div>
          </div>}
          {reconciliation.empty && <p className="text-xs text-gray-600">Реестр пуст: 0 ЭСФ, сумма 0.</p>}
          <div className="bg-gray-50 border border-gray-150 p-4 rounded flex flex-wrap gap-6 text-xs max-w-2xl font-bold">
            <div className="text-gray-700 flex items-center gap-1"><Check size={14} />Сопоставлено: {reconciliation.matched} ЭСФ</div>
            <div className="text-gray-600 flex items-center gap-1"><AlertTriangle size={14} />Не сопоставлено: {reconciliation.unmatched} ЭСФ</div>
            {reconciliation.taxSummary && (
              <div className="text-gray-600 border-l border-gray-350 pl-6 font-semibold">
                НДС (Soliq): {formatSum(reconciliation.taxSummary.vat)}
              </div>
            )}
            {reconciliation.bankOnly.length > 0 && reconciliation.soliqOnly.length > 0 && !aiMatching && (
              <div className="ml-auto">
                <button
                  onClick={handleAiMatch}
                  disabled={aiMatching || saving}
                  className="text-[10px] font-bold bg-black text-white px-4 py-2 uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  Распознать ИИ
                </button>
              </div>
            )}
          </div>

          {/* AI error banner */}
          {aiError && (
            <div className="flex items-center gap-2 rounded p-3 text-xs max-w-2xl bg-rose-50 border border-rose-200 text-rose-800">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {/* AI status banner — shown while auto-matching or after */}
          {(aiMatching || (reconciliation.bankOnly.length === 0 && reconciliation.soliqOnly.length === 0 && reconciliation.matched > 0)) && (
            <div className={`flex items-center gap-2 rounded p-3 text-xs max-w-2xl ${aiMatching ? "bg-blue-50 border border-blue-200 text-blue-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
              {aiMatching ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 shrink-0 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span>
                    ИИ сопоставляет {reconciliation.bankOnly.length} банковских записей с {reconciliation.soliqOnly.length} ЭСФ...
                  </span>
                </>
              ) : (
                <>
                  <Check size={13} className="shrink-0 text-green-600" />
                  <span>Все позиции сопоставлены</span>
                </>
              )}
            </div>
          )}

          {/* Grid comparison */}
          <div className="border border-gray-200 rounded overflow-hidden max-w-3xl">
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full table-fixed text-left border-collapse text-[11px] [overflow-wrap:anywhere]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                    <th className="p-2.5">По банку (Авансы)</th>
                    <th className="p-2 w-14 text-center">Статус</th>
                    <th className="p-2.5">По Soliq (ЭСФ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {/* Matches */}
                  {reconciliation.matches.map((m: any, idx: number) => (
                    <tr key={`m-${idx}`} className="hover:bg-gray-50/50">
                      <td className="p-2.5 text-gray-700">
                        <div className="font-bold">{m.counterpartyName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{formatSum(m.amount)}</div>
                      </td>
                      <td className="p-2.5 text-center text-gray-700"><Check size={14} className="mx-auto text-gray-600" /></td>
                      <td className="p-2.5 text-gray-700">
                        <div className="font-bold">{m.counterpartyName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{formatSum(m.amount)}</div>
                      </td>
                    </tr>
                  ))}

                  {/* Bank Only */}
                  {reconciliation.bankOnly.map((b: any, idx: number) => (
                    <tr key={`b-${idx}`} className="hover:bg-gray-50/50">
                      <td className="p-2.5 text-gray-700">
                        <div className="font-bold text-rose-700">{b.counterpartyName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {formatSum(b.amount)}
                          {b.date && (
                            <span className="ml-2 text-gray-400">
                              {new Date(b.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-center text-rose-500 text-xs font-bold">◄─►</td>
                      <td className="p-2.5">
                        {reconciliation.soliqOnly.length > 0 ? (
                          <SearchableSelect
                            options={reconciliation.soliqOnly.map((s: any) => ({
                              value: s.id,
                              label: `${s.counterpartyName} (${formatSum(s.amount)})`,
                            }))}
                            value=""
                            onChange={(v) => { if (v) handleManualMatch(b.id, v); }}
                            disabled={aiMatching || saving}
                            placeholder="— выбрать ЭСФ вручную —"
                          />
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">(нет ЭСФ для сопоставления)</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Soliq Only */}
                  {reconciliation.soliqOnly.map((s: any, idx: number) => (
                    <tr key={`s-${idx}`} className="hover:bg-gray-50/50">
                      <td className="p-2.5">
                        {reconciliation.bankOnly.length > 0 ? (
                          <SearchableSelect
                            options={reconciliation.bankOnly.map((b: any) => ({
                              value: b.id,
                              label: `${b.counterpartyName} (${formatSum(b.amount)})`,
                            }))}
                            value=""
                            onChange={(v) => { if (v) handleManualMatch(v, s.id); }}
                            disabled={aiMatching || saving}
                            placeholder="— выбрать из банка вручную —"
                          />
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">(нет авансов для сопоставления)</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center text-rose-500 text-xs font-bold">◄─►</td>
                      <td className="p-2.5 text-gray-700">
                        <div className="font-bold text-rose-700">{s.counterpartyName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{formatSum(s.amount)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
          {saveError}
        </div>
      )}

      {/* Nav Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={onPrev}
          disabled={busy}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          ← Назад
        </button>
        <button
          onClick={handleConfirm}
          disabled={busy || discardReason !== null || (imported && !!reconciliation) || (!reconciliation && (!!pendingError || pendingBatches.length > 0))}
          className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition"
        >
          {saving ? "Обработка..." : imported ? "Продолжить →" : reconciliation ? "Провести реестр и продолжить →" : "Пропустить шаг →"}
        </button>
      </div>
    </div>
  );
}
