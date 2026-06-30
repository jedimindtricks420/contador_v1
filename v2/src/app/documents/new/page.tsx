"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClientLayout from "@/components/Layout/ClientLayout";
import { AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";

interface DocumentType {
  id: string;
  code: string;
  name: string;
  mode: string;
  postingTemplate: {
    lines: { accountCode: string; side: string; expression: string; condition?: string }[];
  };
}

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
}

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

export default function NewDocumentPage() {
  const router = useRouter();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payload, setPayload] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/v2/api/document-types").then(r => r.json()),
      fetch("/v2/api/periods").then(r => r.json())
    ]).then(([types, perds]) => {
      // Show all types (including manual) for manual document creation
      setDocTypes(Array.isArray(types) ? types : []);
      const openPerds = Array.isArray(perds) ? perds.filter((p: Period) => p.status !== "CLOSED") : [];
      setPeriods(openPerds);
      if (openPerds.length > 0) setSelectedPeriodId(openPerds[0].id);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const selectedType = docTypes.find(t => t.id === selectedTypeId);

  // Determine required payload fields from template
  const payloadFields: string[] = [];
  if (selectedType?.postingTemplate?.lines) {
    const seen = new Set<string>();
    for (const line of selectedType.postingTemplate.lines) {
      // Extract variable names from expressions (simple heuristic: words that aren't operators)
      const vars = line.expression.match(/\b[a-zA-Z][a-zA-Z0-9_]*\b/g) || [];
      for (const v of vars) {
        if (!["salaryAmount","depreciationAmount","rentAmount","taxAmount","fxDifference","amount",
              "acquisitionCost","residualValue","salePrice","vatRate","isVatPayer"].includes(v)) continue;
        if (!seen.has(v)) { seen.add(v); payloadFields.push(v); }
      }
      // Dynamic account codes
      if (line.accountCode.startsWith("$")) {
        const fieldName = line.accountCode.slice(1);
        if (!seen.has(fieldName)) { seen.add(fieldName); payloadFields.push(fieldName); }
      }
    }
    // Always include `amount` as a fallback
    if (!seen.has("amount")) payloadFields.push("amount");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId || !selectedPeriodId || !date) {
      setError("Заполните все обязательные поля");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const numericPayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        const n = parseFloat(v);
        numericPayload[k] = isNaN(n) ? v : n;
      }
      const res = await fetch("/v2/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: selectedTypeId, periodId: selectedPeriodId, date, payload: numericPayload })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/documents"), 1500);
      } else {
        const err = await res.json();
        setError(err.error || "Ошибка при создании документа");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Создать документ вручную</h1>
            <p className="text-xs text-gray-400 mt-0.5">Создание проводки без банковской транзакции</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : success ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-bold text-gray-800">Документ создан и проведён!</p>
            <p className="text-xs text-gray-400">Переходим на список документов...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-gray-200 rounded p-6">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500">Тип документа *</label>
              <select
                value={selectedTypeId}
                onChange={e => { setSelectedTypeId(e.target.value); setPayload({}); }}
                required
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
              >
                <option value="">— Выберите тип —</option>
                {docTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500">Период *</label>
              <select
                value={selectedPeriodId}
                onChange={e => setSelectedPeriodId(e.target.value)}
                required
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
              >
                {periods.length === 0 && <option value="">— Нет открытых периодов —</option>}
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{MONTH_NAMES[p.month - 1]} {p.year}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500">Дата документа *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
              />
            </div>

            {/* Dynamic payload fields */}
            {selectedType && payloadFields.length > 0 && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-500">Параметры проводки</p>
                {payloadFields.map(field => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">{field}</label>
                    <input
                      type={field.toLowerCase().endsWith("code") ? "text" : "number"}
                      value={payload[field] ?? ""}
                      onChange={e => setPayload(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={field.toLowerCase().endsWith("code") ? "Код счёта, напр. 0140" : "0"}
                      className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 outline-hidden focus:border-black"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving || periods.length === 0}
                className="text-xs bg-black hover:opacity-80 text-white font-bold py-2 px-5 rounded transition disabled:opacity-40"
              >
                {saving ? "Проводка..." : "Создать и провести"}
              </button>
            </div>
          </form>
        )}
      </div>
    </ClientLayout>
  );
}
