"use client";
import React, { useEffect, useState } from "react";
import { FileText, Plus, RotateCcw, AlertCircle, X } from "lucide-react";
import { formatSum, formatDate, periodLabel } from "@/lib/format";
import Link from "next/link";

interface JournalEntry {
  debit: string;
  credit: string;
  account: { code: string; name: string };
}

interface Document {
  id: string;
  date: string;
  status: "POSTED" | "VOIDED";
  type: { id: string; code: string; name: string };
  period: { year: number; month: number } | null;
  journalEntries: JournalEntry[];
}

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
}

export default function DocumentsClient() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);

  const [filterPeriod, setFilterPeriod] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

  const loadFilters = async () => {
    const [pr, dt] = await Promise.all([
      fetch("/v2/api/periods").then(r => r.ok ? r.json() : []),
      fetch("/v2/api/document-types").then(r => r.ok ? r.json() : [])
    ]);
    setPeriods(Array.isArray(pr) ? pr : []);
    setDocTypes(Array.isArray(dt) ? dt : []);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filterPeriod !== "ALL") params.set("periodId", filterPeriod);
      if (filterType !== "ALL") params.set("typeCode", filterType);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      const res = await fetch(`/v2/api/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFilters(); }, []);
  useEffect(() => { loadDocuments(); }, [page, filterPeriod, filterType, filterStatus]);

  const handleVoid = async (docId: string) => {
    if (!confirm("Аннулировать этот документ? Проводки будут удалены.")) return;
    setVoidingId(docId);
    setVoidError(null);
    try {
      const res = await fetch("/v2/api/posting/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId })
      });
      if (res.ok) {
        loadDocuments();
      } else {
        const err = await res.json();
        setVoidError(err.error || "Ошибка аннулирования");
      }
    } catch (e: any) {
      setVoidError(e.message);
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Документы</h1>
          <p className="text-xs text-gray-400 mt-0.5">Все проведённые бухгалтерские документы</p>
        </div>
        <Link
          href="/v2/documents/new"
          className="inline-flex items-center gap-1.5 text-xs bg-black hover:opacity-80 text-white font-bold py-2.5 px-5 rounded transition"
        >
          <Plus size={13} /> Создать вручную
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterPeriod}
          onChange={e => { setFilterPeriod(e.target.value); setPage(1); }}
          className="bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-700 outline-hidden focus:border-black"
        >
          <option value="ALL">Все периоды</option>
          {periods.map(p => (
            <option key={p.id} value={p.id}>{MONTH_NAMES[p.month - 1]} {p.year}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-700 outline-hidden focus:border-black"
        >
          <option value="ALL">Все типы</option>
          {docTypes.map(t => (
            <option key={t.id} value={t.code}>{t.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-700 outline-hidden focus:border-black"
        >
          <option value="ALL">Все статусы</option>
          <option value="POSTED">Проведён</option>
          <option value="VOIDED">Аннулирован</option>
        </select>

        <button onClick={() => { setFilterPeriod("ALL"); setFilterType("ALL"); setFilterStatus("ALL"); setPage(1); }}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
          <RotateCcw size={11} /> Сброс
        </button>

        <span className="text-xs text-gray-400 ml-auto">{total} документов</span>
      </div>

      {voidError && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-semibold">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />{voidError}
          <button onClick={() => setVoidError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Дата</th>
                <th className="py-3 px-4">Тип документа</th>
                <th className="py-3 px-4">Период</th>
                <th className="py-3 px-4">Проводки</th>
                <th className="py-3 px-4">Статус</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300"></div>
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                    <div className="font-semibold text-gray-500">Документов нет</div>
                  </td>
                </tr>
              ) : (
                documents.map(doc => (
                  <React.Fragment key={doc.id}>
                    <tr
                      className={`hover:bg-gray-50/50 cursor-pointer ${doc.status === "VOIDED" ? "opacity-50" : ""}`}
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                    >
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap font-medium">
                        {new Date(doc.date).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-800">{doc.type.name}</div>
                        <div className="text-[10px] font-mono text-gray-400">{doc.type.code}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {doc.period ? `${MONTH_NAMES[doc.period.month - 1]} ${doc.period.year}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {doc.journalEntries.length} записей
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${doc.status === "POSTED" ? "bg-black text-white border-black" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                          {doc.status === "POSTED" ? "Проведён" : "Аннулирован"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {doc.status === "POSTED" && (
                          <button
                            onClick={e => { e.stopPropagation(); handleVoid(doc.id); }}
                            disabled={voidingId === doc.id}
                            className="text-xs text-gray-400 hover:text-rose-600 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition disabled:opacity-40"
                          >
                            {voidingId === doc.id ? "..." : "Аннулировать"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === doc.id && doc.journalEntries.length > 0 && (
                      <tr key={`${doc.id}-detail`}>
                        <td colSpan={6} className="px-8 pb-3 bg-gray-50/50">
                          <table className="w-full text-[11px] border-collapse">
                            <thead>
                              <tr className="text-[9px] font-bold text-gray-400 uppercase">
                                <th className="py-1 text-left">Счёт</th>
                                <th className="py-1 text-right">Дебет</th>
                                <th className="py-1 text-right">Кредит</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono">
                              {doc.journalEntries.map((je, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="py-1 text-gray-600">{je.account.code} — {je.account.name}</td>
                                  <td className="py-1 text-right text-gray-800">{Number(je.debit) > 0 ? formatSum(Number(je.debit)) : ""}</td>
                                  <td className="py-1 text-right text-gray-800">{Number(je.credit) > 0 ? formatSum(Number(je.credit)) : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
            ← Назад
          </button>
          <span className="text-xs text-gray-500 self-center">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
