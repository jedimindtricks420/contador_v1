"use client";
import { useEffect, useState } from "react";
import { Upload, RotateCcw, X } from "lucide-react";
import { formatSum } from "@/lib/format";

interface Step1ImportProps {
  periodId: string;
  onNext: () => void;
  stats: any;
  onRefreshStats: () => void;
}

interface LastBatch {
  batchId: string;
  count: number;
  fileName: string;
}

export default function Step1Import({ periodId, onNext, stats, onRefreshStats }: Step1ImportProps) {
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const parserType = "AUTO";
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState("");
  const [lastBatch, setLastBatch] = useState<LastBatch | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        const res = await fetch("/v2/api/bank-accounts");
        const list = await res.json();
        setBankAccounts(list);
        if (list.length > 0) {
          setSelectedBankAccountId(list[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadBankAccounts();
  }, []);

  const handleImport = async () => {
    if (!uploadFile || !selectedBankAccountId) return;
    setUploading(true);
    setUploadResult("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("bankAccountId", selectedBankAccountId);
      fd.append("parserType", parserType);

      const res = await fetch("/v2/api/import/bank", {
        method: "POST",
        body: fd
      });
      const result = await res.json();
      if (res.ok) {
        setUploadResult(`Импортировано: ${result.imported} транзакций, дубликатов: ${result.duplicates}`);
        if (result.importBatchId && result.imported > 0) {
          setLastBatch({ batchId: result.importBatchId, count: result.imported, fileName: uploadFile.name });
        }
        setUploadFile(null);
        onRefreshStats();
      } else {
        setUploadResult(`Ошибка: ${result.error}`);
      }
    } catch (err: any) {
      setUploadResult(`Ошибка сети: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRollback = async () => {
    if (!lastBatch) return;
    setRollingBack(true);
    try {
      const res = await fetch("/v2/api/import/bank/rollback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: lastBatch.batchId })
      });
      const result = await res.json();
      if (res.ok) {
        setLastBatch(null);
        setUploadResult("");
        setShowRollbackConfirm(false);
        onRefreshStats();
      } else {
        alert(`Ошибка отката: ${result.error}`);
        setShowRollbackConfirm(false);
      }
    } catch (err: any) {
      alert(`Ошибка сети: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 1. Загрузка банковской выписки</h2>
        <p className="text-xs text-gray-400 mt-1">
          Загрузите выписку за отчётный период, чтобы система могла распознать и распределить все движения денег.
        </p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded border border-gray-150 bg-gray-50/50">
            <div className="text-xs font-semibold text-gray-400">Всего операций загружено</div>
            <div className="text-2xl font-bold text-gray-850 mt-1">{stats.totalImported}</div>
          </div>
          <div className="p-4 rounded border border-gray-150 bg-gray-50/50">
            <div className="text-xs font-semibold text-gray-400">Требуют уточнения (внимания)</div>
            <div className="text-2xl font-bold text-gray-850 mt-1">{stats.needsClarification}</div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400">Загрузка статистики...</div>
      )}

      {/* Upload Panel */}
      <div className="bg-gray-50/20 border border-gray-200 rounded p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Банковский счёт</label>
          <select
            value={selectedBankAccountId}
            onChange={(e) => setSelectedBankAccountId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-700 outline-hidden font-semibold"
          >
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.currency})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Формат выписки определяется автоматически (.txt / .xlsx)</p>
        </div>

        {/* Dotted upload zone */}
        <div className="border-2 border-dashed border-gray-200 hover:border-gray-300 rounded p-6 text-center transition duration-200">
          <input
            type="file"
            id="wizardBankFile"
            accept=".txt,.xls,.xlsx"
            onChange={(e) => {
              setUploadFile(e.target.files?.[0] || null);
              setUploadResult("");
            }}
            className="hidden"
          />
          <label htmlFor="wizardBankFile" className="cursor-pointer space-y-1 block">
            <Upload className="h-7 w-7 text-gray-400 mx-auto" />
            <div className="text-sm font-semibold text-gray-750">
              {uploadFile ? uploadFile.name : "Выберите файл выписки"}
            </div>
            <div className="text-[10px] text-gray-400">
              Поддерживаются форматы .txt, .xlsx, .xls
            </div>
          </label>
        </div>

        {uploadFile && (
          <button
            onClick={handleImport}
            disabled={uploading}
            className="w-full bg-black hover:opacity-80 text-white text-xs font-bold py-2 rounded transition disabled:opacity-50"
          >
            {uploading ? "Импорт..." : "Загрузить и распознать выписку"}
          </button>
        )}

        {uploadResult && (
          <div className="p-3 text-xs font-semibold bg-gray-100 text-black rounded border border-gray-300">
            {uploadResult}
          </div>
        )}

        {lastBatch && (
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded text-xs">
            <span className="text-green-800 font-semibold">
              Загружено {lastBatch.count} транзакций из «{lastBatch.fileName}»
            </span>
            <button
              onClick={() => setShowRollbackConfirm(true)}
              className="flex items-center gap-1 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 bg-white py-1 px-2.5 rounded font-semibold transition ml-4 shrink-0"
            >
              <RotateCcw size={12} />
              Отменить загрузку
            </button>
          </div>
        )}
      </div>

      {/* Nav Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={onNext}
          className="text-xs bg-gray-100 hover:bg-gray-250 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          Пропустить шаг
        </button>
        <button
          onClick={() => { setLastBatch(null); onNext(); }}
          className="text-xs bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded transition"
        >
          Перейти к уточнению →
        </button>
      </div>

      {/* Rollback confirm modal */}
      {showRollbackConfirm && lastBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-red-500 shrink-0 mt-0.5" />
                <h3 className="text-sm font-bold text-gray-800">Отменить загрузку?</h3>
              </div>
              <button onClick={() => setShowRollbackConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Будут удалены <strong>{lastBatch.count} транзакций</strong> из «{lastBatch.fileName}». Действие
              необратимо, если некоторые транзакции уже классифицированы — откат будет заблокирован.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRollbackConfirm(false)}
                disabled={rollingBack}
                className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded transition"
              >
                Отмена
              </button>
              <button
                onClick={handleRollback}
                disabled={rollingBack}
                className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition disabled:opacity-50"
              >
                {rollingBack ? "Удаление..." : "Да, откатить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
