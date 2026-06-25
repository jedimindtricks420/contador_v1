"use client";
import { useEffect, useState } from "react";
import { Check, AlertCircle, RefreshCw, FileText, ArrowRight } from "lucide-react";
import { formatSum } from "@/lib/format";

interface OpenItem {
  id: string;
  amount: number;
  dateOpened: string;
  account: {
    code: string;
    name: string;
  };
  counterparty?: {
    name: string;
    inn?: string;
  };
}

interface Step7EInvoicesProps {
  periodId: string;
  onNext: (payload: any) => void;
  onPrev: () => void;
}

export default function Step7EInvoices({ periodId, onNext, onPrev }: Step7EInvoicesProps) {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadPendingItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/v2/api/closing/${periodId}/pending-invoices`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        setError("Не удалось загрузить список нераспределенных авансов");
      }
    } catch {
      setError("Ошибка сети при загрузке данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingItems();
  }, [periodId]);

  const handleConfirmItem = async (openItemId: string) => {
    setProcessingId(openItemId);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/v2/api/closing/${periodId}/pending-invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openItemId })
      });

      if (res.ok) {
        setActionSuccess("Аванс успешно подтвержден и закрыт проводочным документом!");
        // Remove from list
        setItems((prev) => prev.filter((item) => item.id !== openItemId));
      } else {
        const err = await res.json();
        setError(`Ошибка подтверждения: ${err.error}`);
      }
    } catch {
      setError("Ошибка сети при отправке подтверждения");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-800">Шаг 7. Подтверждение подписанных ЭСФ вручную</h2>
        <p className="text-xs text-gray-400 mt-1">
          Здесь показаны авансы текущего периода, которые не были автоматически сопоставлены с ЭСФ из Soliq. Вы можете подтвердить закрытие аванса вручную.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-400 text-xs">
          <RefreshCw className="animate-spin h-4 w-4 mr-2" />
          Загрузка нераспределенных авансов...
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-150 rounded text-xs text-rose-800 font-semibold flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-150 rounded text-xs text-emerald-800 font-semibold flex items-start gap-2">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{actionSuccess}</div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="bg-gray-50/50 border border-gray-150 rounded-lg p-8 text-center max-w-xl">
          <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-700">Нет зависших авансов</p>
          <p className="text-xs text-gray-450 mt-1">
            Все авансы за этот период были успешно сопоставлены автоматически с реестром Soliq либо закрыты на прошлых шагах.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-amber-50/30 border border-amber-200/60 p-3.5 rounded text-xs text-amber-850 font-medium">
            Ниже перечислены оплаты. Если товар или услуга по ним фактически получены/отгружены в этом месяце (т.е. ЭСФ подписан, но отсутствовал в Soliq или не совпали реквизиты), нажмите «Подтвердить закрытие». Будет создана проводка признания доходов (по 6310) или расходов (по 4310). В противном случае оставьте платеж как переходящий аванс.
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                    <th className="p-3">Контрагент</th>
                    <th className="p-3">Счет</th>
                    <th className="p-3">Сумма аванса</th>
                    <th className="p-3">Дата</th>
                    <th className="p-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/40">
                      <td className="p-3 text-gray-800">
                        <div className="font-bold">{item.counterparty?.name || "Неизвестный контрагент"}</div>
                        {item.counterparty?.inn && (
                          <div className="text-[10px] text-gray-400 font-mono">ИНН: {item.counterparty.inn}</div>
                        )}
                      </td>
                      <td className="p-3 text-gray-650">
                        <span className="font-bold font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 mr-1.5">
                          {item.account.code}
                        </span>
                        <span className="text-[11px] font-medium text-gray-500">{item.account.name}</span>
                      </td>
                      <td className="p-3 text-gray-900 font-bold font-mono">
                        {formatSum(item.amount)}
                      </td>
                      <td className="p-3 text-gray-400 text-[11px]">
                        {new Date(item.dateOpened).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleConfirmItem(item.id)}
                          disabled={processingId !== null}
                          className="inline-flex items-center gap-1 bg-black text-white hover:opacity-85 disabled:opacity-50 text-[11px] font-bold px-3 py-1.5 rounded transition"
                        >
                          {processingId === item.id ? (
                            <RefreshCw className="animate-spin h-3 w-3" />
                          ) : (
                            <FileText size={12} />
                          )}
                          Подтвердить закрытие
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100 max-w-3xl">
        <button
          onClick={onPrev}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-5 rounded transition"
        >
          ← Назад
        </button>
        <div className="flex items-center gap-3">
          {!loading && items.length > 0 && (
            <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
              <AlertCircle size={13} />
              Закройте {items.length} {items.length === 1 ? "аванс" : items.length < 5 ? "аванса" : "авансов"} перед продолжением
            </span>
          )}
          <button
            onClick={() => onNext({})}
            disabled={loading || items.length > 0}
            className="inline-flex items-center gap-1.5 text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-6 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Далее <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
