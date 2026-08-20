"use client";
import { useState, useEffect, useRef } from "react";
import { BarChart2, Check, AlertTriangle } from "lucide-react";
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

export default function Step6Soliq({ periodId, onNext, onPrev, initialSoliqMatched }: Step6SoliqProps) {
  const [soliqFile, setSoliqFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [emptyRegistryNotice, setEmptyRegistryNotice] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<any | null>(null);
  const [reconciliationFileName, setReconciliationFileName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const autoAiTriggered = useRef(false);

  const handleUpload = async () => {
    if (!soliqFile) return;
    setUploading(true);
    setUploadError(null);
    setEmptyRegistryNotice(null);
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
        if (data.empty) {
          // Registry recognized but has no invoices with amounts — nothing to reconcile
          setEmptyRegistryNotice(data.message);
          setSoliqFile(null);
        } else {
          setReconciliation(data);
          setReconciliationFileName(soliqFile.name);
          setSoliqFile(null);
        }
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
    setSaving(true);
    setSaveError(null);
    try {
      const payload = reconciliation ? {
        matched: reconciliation.matched,
        unmatched: reconciliation.unmatched,
        parsedPayload: reconciliation.parsedPayload
      } : {
        matched: initialSoliqMatched?.matched || 0,
        unmatched: initialSoliqMatched?.unmatched || 0
      };

      const res = await fetch(`/v2/api/closing/${periodId}/step/6/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onNext({ soliqMatched: payload });
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
    const newReconciliation = { ...reconciliation };

    const bankItemIndex = newReconciliation.bankOnly.findIndex((b: any) => b.id === bankId);
    const soliqItemIndex = newReconciliation.soliqOnly.findIndex((s: any) => s.id === soliqId);
    if (bankItemIndex < 0 || soliqItemIndex < 0) return;

    const bankItem = newReconciliation.bankOnly[bankItemIndex];
    const soliqItem = newReconciliation.soliqOnly[soliqItemIndex];

    if (newReconciliation.parsedPayload && newReconciliation.parsedPayload.esfItems) {
      const esfPayloadItem = newReconciliation.parsedPayload.esfItems.find(
        (e: any) => e.inn === soliqItem.inn && (e.amount + e.vatAmount) === soliqItem.amount && e.matchStatus === "UNMATCHED"
      );
      if (esfPayloadItem) {
        esfPayloadItem.matchStatus = "MATCHED";
        esfPayloadItem.matchedOpenItemId = bankId;
        esfPayloadItem.matchedAmount = bankItem.amount;
        esfPayloadItem.matchedAccountCode = bankItem.accountCode ?? "6310";
      }
    }

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
        const newReconciliation = { ...reconciliation };
        
        data.matches.forEach((match: any) => {
          const bankItemIndex = newReconciliation.bankOnly.findIndex((b: any) => b.id === match.bankId);
          const soliqItemIndex = newReconciliation.soliqOnly.findIndex((s: any) => s.id === match.soliqId);
          
          if (bankItemIndex >= 0 && soliqItemIndex >= 0) {
            const bankItem = newReconciliation.bankOnly[bankItemIndex];
            const soliqItem = newReconciliation.soliqOnly[soliqItemIndex];

            // Update parsed payload BEFORE splice so bankItem reference is still valid
            if (newReconciliation.parsedPayload && newReconciliation.parsedPayload.esfItems) {
              const esfPayloadItem = newReconciliation.parsedPayload.esfItems.find(
                (e: any) => e.inn === soliqItem.inn && (e.amount + e.vatAmount) === soliqItem.amount && e.matchStatus === "UNMATCHED"
              );
              if (esfPayloadItem) {
                esfPayloadItem.matchStatus = "MATCHED";
                esfPayloadItem.matchedOpenItemId = match.bankId;
                esfPayloadItem.matchedAmount = bankItem.amount;
                esfPayloadItem.matchedAccountCode = bankItem.accountCode ?? "6310";
              }
            }

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

  // Auto-trigger AI matching after upload if there are unmatched items on both sides
  useEffect(() => {
    if (
      reconciliation &&
      !autoAiTriggered.current &&
      reconciliation.bankOnly.length > 0 &&
      reconciliation.soliqOnly.length > 0
    ) {
      autoAiTriggered.current = true;
      handleAiMatch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconciliation]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 6. Сверка с порталом my.soliq.uz</h2>
        <p className="text-xs text-gray-400 mt-1">
          Загрузите Excel-выгрузку реестра ЭСФ, чтобы сопоставить выставленные счета-фактуры с открытыми авансами в банке.
          Файл может охватывать несколько месяцев — сверка выполняется по всем открытым авансам, включая прошлые периоды.
        </p>
      </div>

      {/* Upload Zone */}
      {!reconciliation && (
        <div className="bg-gray-50/20 border border-gray-200 rounded p-5 space-y-4 max-w-xl">
          <div className="border-2 border-dashed border-gray-200 hover:border-gray-200 rounded p-6 text-center transition duration-200">
            <input
              type="file"
              id="wizardSoliqFile"
              accept=".xlsx,.xls,.xltx"
              onChange={(e) => { setSoliqFile(e.target.files?.[0] || null); setEmptyRegistryNotice(null); }}
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

          {emptyRegistryNotice && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <Check size={14} className="shrink-0 text-green-600" />
                <span>{emptyRegistryNotice}</span>
              </div>
              <div className="pl-6 text-green-700">
                Если оборота по ЭСФ в этом периоде не было, нажмите «Пропустить шаг →», чтобы завершить сверку и продолжить закрытие месяца.
              </div>
            </div>
          )}

          {soliqFile && (
            <button
              onClick={handleUpload}
              disabled={uploading}
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
          <div className="flex items-center justify-between max-w-2xl">
            <div className="text-xs text-gray-500 font-medium truncate">
              Файл: <span className="font-semibold text-gray-700">{reconciliationFileName}</span>
            </div>
            <button
              onClick={() => { setReconciliation(null); setReconciliationFileName(""); setSoliqFile(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 py-1 px-2.5 rounded font-semibold transition ml-4 shrink-0"
            >
              × Заменить файл
            </button>
          </div>
          <div className="bg-gray-50 border border-gray-150 p-4 rounded flex gap-6 text-xs max-w-2xl font-bold">
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
                  disabled={aiMatching}
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
                  <span>ИИ завершил сопоставление — все позиции обработаны</span>
                </>
              )}
            </div>
          )}

          {/* Grid comparison */}
          <div className="border border-gray-200 rounded overflow-hidden max-w-3xl">
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                    <th className="p-2.5 w-[45%]">По банку (Авансы)</th>
                    <th className="p-2.5 w-[10%] text-center">Статус</th>
                    <th className="p-2.5 w-[45%]">По Soliq (ЭСФ)</th>
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
                            disabled={aiMatching}
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
                            disabled={aiMatching}
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
          disabled={saving}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          ← Назад
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition"
        >
          {saving ? "Обработка..." : reconciliation ? "Принять всё совпавшее и продолжить →" : "Пропустить шаг →"}
        </button>
      </div>
    </div>
  );
}
