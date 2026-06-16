"use client";
import React, { useState, useEffect } from "react";
import { Printer, Folder } from "lucide-react";
import ReportFilters from "@/components/reports/ReportFilters";
import { formatReportSum } from "@/lib/reports/format";

interface SubcontoRow {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyInn: string | null;
  accountId: string;
  accountCode: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  debitTurnover: number;
  creditTurnover: number;
  closingDebit: number;
  closingCredit: number;
}

interface SubcontoData {
  rows: SubcontoRow[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    debitTurnover: number;
    creditTurnover: number;
    closingDebit: number;
    closingCredit: number;
  };
}

export default function SubcontoClient() {
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
  const [data, setData] = useState<SubcontoData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubconto = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        accountId
      });
      const res = await fetch(`/v2/api/reports/subconto?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("Failed to load subconto");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubconto();
  }, [from, to, accountId]);

  // Group rows by counterparty in-memory
  const groupData = () => {
    if (!data) return [];
    const grouped: Record<string, {
      counterpartyId: string;
      counterpartyName: string;
      counterpartyInn: string | null;
      rows: SubcontoRow[];
      totals: {
        openingDebit: number;
        openingCredit: number;
        debitTurnover: number;
        creditTurnover: number;
        closingDebit: number;
        closingCredit: number;
      };
    }> = {};

    for (const row of data.rows) {
      if (!grouped[row.counterpartyId]) {
        grouped[row.counterpartyId] = {
          counterpartyId: row.counterpartyId,
          counterpartyName: row.counterpartyName,
          counterpartyInn: row.counterpartyInn,
          rows: [],
          totals: {
            openingDebit: 0,
            openingCredit: 0,
            debitTurnover: 0,
            creditTurnover: 0,
            closingDebit: 0,
            closingCredit: 0
          }
        };
      }

      const cpGroup = grouped[row.counterpartyId];
      cpGroup.rows.push(row);
      cpGroup.totals.openingDebit += row.openingDebit;
      cpGroup.totals.openingCredit += row.openingCredit;
      cpGroup.totals.debitTurnover += row.debitTurnover;
      cpGroup.totals.creditTurnover += row.creditTurnover;
      cpGroup.totals.closingDebit += row.closingDebit;
      cpGroup.totals.closingCredit += row.closingCredit;
    }

    return Object.values(grouped);
  };

  const groupedGroups = groupData();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
          Анализ субконто (Контрагенты)
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
      />

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Анализ задолженностей и взаиморасчётов по субконто...
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Данные не найдены за выбранный период
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th rowSpan={2} style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700 }}>Субконто (Контрагент) / Счёт</th>
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
              {groupedGroups.map((group) => (
                <React.Fragment key={group.counterpartyId}>
                  {/* Group header row */}
                  <tr style={{ background: "#f1f5f9", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "10px 8px", color: "#1e293b" }}>
                      <Folder size={13} style={{ display: "inline", marginRight: 5 }} />{group.counterpartyName} {group.counterpartyInn ? `(ИНН ${group.counterpartyInn})` : ""}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatReportSum(group.totals.openingDebit)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatReportSum(group.totals.openingCredit)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatReportSum(group.totals.debitTurnover)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatReportSum(group.totals.creditTurnover)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatReportSum(group.totals.closingDebit)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatReportSum(group.totals.closingCredit)}</td>
                  </tr>

                  {/* Account detail rows */}
                  {group.rows.map((row) => (
                    <tr key={`${row.counterpartyId}-${row.accountId}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 8px 8px 32px", color: "#475569" }}>
                        <strong>{row.accountCode}</strong> — {row.accountName}
                      </td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>{formatReportSum(row.openingDebit)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>{formatReportSum(row.openingCredit)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>{formatReportSum(row.debitTurnover)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>{formatReportSum(row.creditTurnover)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>{formatReportSum(row.closingDebit)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right" }}>{formatReportSum(row.closingCredit)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* Grand totals row */}
              <tr style={{ background: "#e2e8f0", borderTop: "2px solid #94a3b8", fontWeight: 700 }}>
                <td style={{ padding: 12, color: "#0f172a" }}>Итого по всем контрагентам:</td>
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
