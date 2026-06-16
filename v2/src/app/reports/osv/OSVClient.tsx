"use client";
import React, { useState, useEffect } from "react";
import { Printer, Folder } from "lucide-react";
import ReportFilters from "@/components/reports/ReportFilters";
import { formatReportSum } from "@/lib/reports/format";

interface SubcontoRow {
  counterpartyId: string;
  counterpartyName: string;
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
}

interface OSVRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
  subconto?: SubcontoRow[];
}

interface OSVTotals {
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
}

export default function OSVClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  });

  const [expandSubconto, setExpandSubconto] = useState(true);
  const [data, setData] = useState<{ rows: OSVRow[]; totals: OSVTotals } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  const loadOSV = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/v2/api/reports/osv?from=${from}&to=${to}&expandSubconto=${expandSubconto}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("Failed to load OSV");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOSV();
  }, [from, to, expandSubconto]);

  const toggleAccountExpand = (accId: string) => {
    setExpandedAccounts(prev => ({ ...prev, [accId]: !prev[accId] }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
          Оборотно-сальдовая ведомость
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
        showSubcontoCheckbox={true}
        expandSubconto={expandSubconto}
        onChangeExpandSubconto={setExpandSubconto}
      />

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Вычисление ОСВ по журналу проводок...
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Нет проводок за выбранный период
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th rowSpan={2} style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700 }}>Счёт</th>
                <th rowSpan={2} style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700 }}>Название счёта</th>
                <th colSpan={2} style={{ padding: 6, textAlign: "center", color: "#475569", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Сальдо на начало</th>
                <th colSpan={2} style={{ padding: 6, textAlign: "center", color: "#475569", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Обороты за период</th>
                <th colSpan={2} style={{ padding: 6, textAlign: "center", color: "#475569", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Сальдо на конец</th>
              </tr>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 110 }}>Дебет</th>
                <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 110 }}>Кредит</th>
                <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 110 }}>Дебет</th>
                <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 110 }}>Кредит</th>
                <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 110 }}>Дебет</th>
                <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 110 }}>Кредит</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const isExpanded = !!expandedAccounts[row.accountId];
                const hasSubconto = expandSubconto && row.subconto && row.subconto.length > 0;

                return (
                  <React.Fragment key={row.accountId}>
                    <tr style={{ borderBottom: "1px solid #f1f5f9", background: hasSubconto && isExpanded ? "#f8fafc" : "transparent" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 600, color: "#0f172a" }}>
                        {hasSubconto ? (
                          <button
                            onClick={() => toggleAccountExpand(row.accountId)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0 4px",
                              marginRight: 6,
                              fontSize: 10,
                              color: "#64748b"
                            }}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        ) : (
                          <span style={{ display: "inline-block", width: 18 }} />
                        )}
                        {row.accountCode}
                      </td>
                      <td style={{ padding: "10px 8px", color: "#334155", fontWeight: 500 }}>
                        {row.accountName}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.openingDebit)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.openingCredit)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.debitTurnover)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.creditTurnover)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{formatReportSum(row.closingDebit)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{formatReportSum(row.closingCredit)}</td>
                    </tr>
                    
                    {/* Render subconto if expanded */}
                    {hasSubconto && isExpanded && row.subconto?.map((sub, idx) => (
                      <tr key={`${row.accountId}-${sub.counterpartyId}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                        <td style={{ padding: "6px 8px 6px 32px", color: "#64748b", fontSize: 12 }} colSpan={2}>
                          <Folder size={12} style={{ display: "inline", marginRight: 4 }} />{sub.counterpartyName}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569", fontSize: 12 }}>{formatReportSum(sub.openingDebit)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569", fontSize: 12 }}>{formatReportSum(sub.openingCredit)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569", fontSize: 12 }}>{formatReportSum(sub.debitTurnover)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569", fontSize: 12 }}>{formatReportSum(sub.creditTurnover)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#334155", fontWeight: 500, fontSize: 12 }}>{formatReportSum(sub.closingDebit)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#334155", fontWeight: 500, fontSize: 12 }}>{formatReportSum(sub.closingCredit)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              
              {/* Totals row */}
              <tr style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1", fontWeight: 700 }}>
                <td style={{ padding: 12, color: "#0f172a" }} colSpan={2}>Итого:</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.openingDebit)}</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.openingCredit)}</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.debitTurnover)}</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.creditTurnover)}</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.closingDebit)}</td>
                <td style={{ padding: 12, textAlign: "right" }}>{formatReportSum(data.totals.closingCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
