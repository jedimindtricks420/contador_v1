"use client";
import { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import ReportFilters from "@/components/reports/ReportFilters";
import { formatReportSum, formatDateStr } from "@/lib/reports/format";

interface JournalRow {
  date: string;
  documentId: string;
  documentNumber: string;
  documentType: string;
  documentTypeName: string;
  counterpartyId: string | null;
  counterpartyName: string;
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  amount: number;
}

interface JournalData {
  rows: JournalRow[];
  total: number;
  totals: {
    totalDebit: number;
    totalCredit: number;
  };
}

export default function JournalClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  });

  const [accountId, setAccountId] = useState("ALL");
  const [counterpartyId, setCounterpartyId] = useState("ALL");
  const [documentTypeId, setDocumentTypeId] = useState("ALL");

  const [data, setData] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidingDocId, setVoidingDocId] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  const loadJournal = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        accountId,
        counterpartyId,
        documentTypeId
      });
      const res = await fetch(`/v2/api/reports/journal?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("Failed to load journal");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJournal();
  }, [from, to, accountId, counterpartyId, documentTypeId]);

  const handleVoid = async (documentId: string) => {
    if (!confirm("Аннулировать этот документ? Все проводки будут удалены.")) return;
    setVoidingDocId(documentId);
    setVoidError(null);
    try {
      const res = await fetch("/v2/api/posting/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId })
      });
      if (res.ok) {
        loadJournal();
      } else {
        const err = await res.json();
        setVoidError(err.error || "Ошибка аннулирования");
      }
    } catch {
      setVoidError("Ошибка сети при аннулировании");
    } finally {
      setVoidingDocId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
          Журнал проводок (Общая книга)
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            <Printer size={14} style={{ display: "inline", marginRight: 6 }} />Печать
          </button>
        </div>
      </div>

      <ReportFilters
        from={from}
        to={to}
        onChangePeriod={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
        showAccountSelect={true}
        accountId={accountId}
        onChangeAccountId={setAccountId}
        allowAllAccounts={true}
        showCounterpartySelect={true}
        counterpartyId={counterpartyId}
        onChangeCounterpartyId={setCounterpartyId}
        showDocumentTypeSelect={true}
        documentTypeId={documentTypeId}
        onChangeDocumentTypeId={setDocumentTypeId}
      />

      {voidError && (
        <div style={{ padding: "10px 14px", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 6, fontSize: 12, color: "#be123c", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
          {voidError}
          <button onClick={() => setVoidError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#be123c" }}>✕</button>
        </div>
      )}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Загрузка журнала проводок...
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Проводки не найдены по выбранным фильтрам
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700, width: 80 }}>Дата</th>
                <th style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700, width: 180 }}>Документ</th>
                <th style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700 }}>Контрагент</th>
                <th style={{ padding: 10, textAlign: "center", color: "#475569", fontWeight: 700, width: 100 }}>Дт счёт</th>
                <th style={{ padding: 10, textAlign: "center", color: "#475569", fontWeight: 700, width: 100 }}>Кт счёт</th>
                <th style={{ padding: 10, textAlign: "right", color: "#475569", fontWeight: 700, width: 140 }}>Сумма</th>
                <th style={{ padding: 10, width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={`${row.documentId}-${index}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, color: "#64748b" }}>{formatDateStr(row.date)}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{row.documentTypeName}</span>
                    <span style={{ color: "#64748b", marginLeft: 6 }}>№{row.documentNumber}</span>
                  </td>
                  <td style={{ padding: 10, color: "#475569" }}>{row.counterpartyName}</td>
                  <td style={{ padding: 10, textAlign: "center", fontWeight: 600, color: "#0284c7" }}>
                    {row.debitAccountCode}
                  </td>
                  <td style={{ padding: 10, textAlign: "center", fontWeight: 600, color: "#ea580c" }}>
                    {row.creditAccountCode}
                  </td>
                  <td style={{ padding: 10, textAlign: "right", fontWeight: 600 }}>
                    {formatReportSum(row.amount)}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    {index === 0 || data.rows[index - 1]?.documentId !== row.documentId ? (
                      <button
                        onClick={() => handleVoid(row.documentId)}
                        disabled={voidingDocId === row.documentId}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "4px 10px",
                          background: "none", border: "1px solid #fca5a5",
                          color: "#ef4444", borderRadius: 4, cursor: "pointer",
                          opacity: voidingDocId === row.documentId ? 0.4 : 1,
                          transition: "all 0.15s"
                        }}
                        title="Аннулировать документ"
                      >
                        {voidingDocId === row.documentId ? "..." : "Аннулировать"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                <td style={{ padding: 12 }} colSpan={3}>Всего записей: {data.total}</td>
                <td style={{ padding: 12, textAlign: "center" }}>—</td>
                <td style={{ padding: 12, textAlign: "center" }}>—</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.totalDebit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
