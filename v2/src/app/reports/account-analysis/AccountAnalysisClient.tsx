"use client";
import { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import ReportFilters from "@/components/reports/ReportFilters";
import { formatReportSum } from "@/lib/reports/format";

interface CorrespondentRow {
  code: string;
  name: string;
  amount: number;
}

interface AccountAnalysisData {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  debitCorrespondents: CorrespondentRow[];
  creditCorrespondents: CorrespondentRow[];
  totalDebit: number;
  totalCredit: number;
}

export default function AccountAnalysisClient() {
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
  const [data, setData] = useState<AccountAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAccountAnalysis = async () => {
    if (!accountId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/v2/api/reports/account-analysis?accountId=${accountId}&from=${from}&to=${to}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("Failed to load account analysis");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountAnalysis();
  }, [accountId, from, to]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
          Анализ счёта
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
          Формирование анализа счёта по журналу проводок...
        </div>
      ) : !data ? (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 14 }}>
          Ошибка загрузки данных
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" }}>
              Анализ счёта {data.account.code} — {data.account.name}
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Период: {new Date(from).toLocaleDateString("ru")} — {new Date(to).toLocaleDateString("ru")}
            </span>
          </div>

          {/* Double column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
            {/* Left Column: Debited from credit of */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  В дебет счёта {data.account.code} с кредита счетов:
                </h4>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <th style={{ padding: 8, textAlign: "left", color: "#64748b", fontWeight: 600, width: 80 }}>Счёт</th>
                    <th style={{ padding: 8, textAlign: "left", color: "#64748b", fontWeight: 600 }}>Название</th>
                    <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 130 }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.debitCorrespondents.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>—</td>
                    </tr>
                  ) : (
                    data.debitCorrespondents.map((row, idx) => (
                      <tr key={`${row.code}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 8, fontWeight: 600 }}>{row.code}</td>
                        <td style={{ padding: 8, color: "#475569" }}>{row.name}</td>
                        <td style={{ padding: 8, textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.amount)}</td>
                      </tr>
                    ))
                  )}
                  <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>
                    <td style={{ padding: 10 }} colSpan={2}>Итого дебет:</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{formatReportSum(data.totalDebit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Column: Credited to debit of */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  В кредит счёта {data.account.code} в дебет счетов:
                </h4>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <th style={{ padding: 8, textAlign: "left", color: "#64748b", fontWeight: 600, width: 80 }}>Счёт</th>
                    <th style={{ padding: 8, textAlign: "left", color: "#64748b", fontWeight: 600 }}>Название</th>
                    <th style={{ padding: 8, textAlign: "right", color: "#64748b", fontWeight: 600, width: 130 }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.creditCorrespondents.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>—</td>
                    </tr>
                  ) : (
                    data.creditCorrespondents.map((row, idx) => (
                      <tr key={`${row.code}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 8, fontWeight: 600 }}>{row.code}</td>
                        <td style={{ padding: 8, color: "#475569" }}>{row.name}</td>
                        <td style={{ padding: 8, textAlign: "right", fontWeight: 500 }}>{formatReportSum(row.amount)}</td>
                      </tr>
                    ))
                  )}
                  <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>
                    <td style={{ padding: 10 }} colSpan={2}>Итого кредит:</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{formatReportSum(data.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
