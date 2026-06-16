"use client";
import { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import ReportFilters from "@/components/reports/ReportFilters";
import { formatReportSum, formatDateStr } from "@/lib/reports/format";

interface AccountCardRow {
  id: string;
  date: string;
  documentId: string;
  documentType: string;
  documentTypeName: string;
  documentNumber: string;
  counterpartyName: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface AccountCardData {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  openingBalance: number;
  rows: AccountCardRow[];
  closingBalance: number;
}

export default function AccountCardClient() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  });

  const [accountId, setAccountId] = useState("");
  const [data, setData] = useState<AccountCardData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAccountCard = async () => {
    if (!accountId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/v2/api/reports/account-card?accountId=${accountId}&from=${from}&to=${to}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("Failed to load account card");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountCard();
  }, [accountId, from, to]);

  // Total debits and credits turnovers
  const debitTurnover = data ? data.rows.reduce((sum, r) => sum + r.debit, 0) : 0;
  const creditTurnover = data ? data.rows.reduce((sum, r) => sum + r.credit, 0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
          Карточка счёта
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
      />

      {!accountId ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Выберите счёт в фильтрах, чтобы сформировать отчёт
        </div>
      ) : loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Формирование карточки счёта по журналу проводок...
        </div>
      ) : !data ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Ошибка загрузки данных
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" }}>
              {data.account.code} — {data.account.name}
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Тип счёта: <strong>{data.account.type}</strong>
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700, width: 80 }}>Дата</th>
                <th style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700 }}>Документ</th>
                <th style={{ padding: 10, textAlign: "left", color: "#475569", fontWeight: 700 }}>Контрагент</th>
                <th style={{ padding: 10, textAlign: "right", color: "#475569", fontWeight: 700, width: 140 }}>Дебет</th>
                <th style={{ padding: 10, textAlign: "right", color: "#475569", fontWeight: 700, width: 140 }}>Кредит</th>
                <th style={{ padding: 10, textAlign: "right", color: "#475569", fontWeight: 700, width: 140 }}>Остаток</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 600 }}>
                <td style={{ padding: 10, color: "#64748b" }}>—</td>
                <td style={{ padding: 10, color: "#475569" }} colSpan={2}>
                  Сальдо на начало периода
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>—</td>
                <td style={{ padding: 10, textAlign: "right" }}>—</td>
                <td style={{ padding: 10, textAlign: "right", color: "#0f172a" }}>
                  {formatReportSum(data.openingBalance)}
                </td>
              </tr>

              {/* Transactions rows */}
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                    Нет движений по счёту за указанный период
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10, color: "#64748b" }}>{formatDateStr(row.date)}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{row.documentTypeName}</span>
                      <span style={{ color: "#64748b", marginLeft: 6 }}>№{row.documentNumber}</span>
                    </td>
                    <td style={{ padding: 10, color: "#475569" }}>{row.counterpartyName}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{formatReportSum(row.debit)}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{formatReportSum(row.credit)}</td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.runningBalance)}</td>
                  </tr>
                ))
              )}

              {/* Turnovers row */}
              <tr style={{ borderTop: "2px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", fontWeight: 600, background: "#fafafa" }}>
                <td style={{ padding: 10 }} colSpan={3}>Обороты за период:</td>
                <td style={{ padding: 10, textAlign: "right" }}>{formatReportSum(debitTurnover)}</td>
                <td style={{ padding: 10, textAlign: "right" }}>{formatReportSum(creditTurnover)}</td>
                <td style={{ padding: 10, textAlign: "right" }}>—</td>
              </tr>

              {/* Closing balance row */}
              <tr style={{ borderBottom: "2px solid #cbd5e1", background: "#f8fafc", fontWeight: 700 }}>
                <td style={{ padding: 10, color: "#64748b" }}>—</td>
                <td style={{ padding: 10, color: "#0f172a" }} colSpan={2}>
                  Сальдо на конец периода
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>—</td>
                <td style={{ padding: 10, textAlign: "right" }}>—</td>
                <td style={{ padding: 10, textAlign: "right", color: "#0f172a" }}>
                  {formatReportSum(data.closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
