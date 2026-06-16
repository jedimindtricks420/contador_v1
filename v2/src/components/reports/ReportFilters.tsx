"use client";
import { useState, useEffect } from "react";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Counterparty {
  id: string;
  name: string;
  inn: string | null;
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
}

interface ReportFiltersProps {
  from: string;
  to: string;
  onChangePeriod: (from: string, to: string) => void;

  showAccountSelect?: boolean;
  accountId?: string;
  onChangeAccountId?: (id: string) => void;
  allowAllAccounts?: boolean;

  showCounterpartySelect?: boolean;
  counterpartyId?: string;
  onChangeCounterpartyId?: (id: string) => void;

  showDocumentTypeSelect?: boolean;
  documentTypeId?: string;
  onChangeDocumentTypeId?: (id: string) => void;

  showSubcontoCheckbox?: boolean;
  expandSubconto?: boolean;
  onChangeExpandSubconto?: (val: boolean) => void;
}

export default function ReportFilters({
  from,
  to,
  onChangePeriod,
  showAccountSelect = false,
  accountId = "",
  onChangeAccountId,
  allowAllAccounts = false,
  showCounterpartySelect = false,
  counterpartyId = "",
  onChangeCounterpartyId,
  showDocumentTypeSelect = false,
  documentTypeId = "",
  onChangeDocumentTypeId,
  showSubcontoCheckbox = false,
  expandSubconto = false,
  onChangeExpandSubconto
}: ReportFiltersProps) {
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "year" | "custom">("month");
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil(currentMonth / 3));

  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);

  // Load select options
  useEffect(() => {
    if (showAccountSelect) {
      fetch("/v2/api/reports/accounts")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAccounts(data);
        })
        .catch(console.error);
    }
  }, [showAccountSelect]);

  useEffect(() => {
    if (showCounterpartySelect) {
      fetch("/v2/api/reports/counterparties")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setCounterparties(data);
        })
        .catch(console.error);
    }
  }, [showCounterpartySelect]);

  useEffect(() => {
    if (showDocumentTypeSelect) {
      fetch("/v2/api/document-types")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setDocTypes(data);
        })
        .catch(console.error);
    }
  }, [showDocumentTypeSelect]);

  // Handle period calculation
  const applyPeriod = (type: typeof periodType, year: number, month: number, quarter: number, cFrom: string, cTo: string) => {
    let fDate = "";
    let tDate = "";

    const formatNum = (n: number) => String(n).padStart(2, "0");

    if (type === "month") {
      fDate = `${year}-${formatNum(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      tDate = `${year}-${formatNum(month)}-${formatNum(lastDay)}`;
    } else if (type === "quarter") {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      fDate = `${year}-${formatNum(startMonth)}-01`;
      const lastDay = new Date(year, endMonth, 0).getDate();
      tDate = `${year}-${formatNum(endMonth)}-${formatNum(lastDay)}`;
    } else if (type === "year") {
      fDate = `${year}-01-01`;
      tDate = `${year}-12-31`;
    } else {
      fDate = cFrom;
      tDate = cTo;
    }

    if (fDate && tDate) {
      onChangePeriod(fDate, tDate);
    }
  };

  useEffect(() => {
    applyPeriod(periodType, selectedYear, selectedMonth, selectedQuarter, customFrom, customTo);
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  const handleCustomApply = () => {
    applyPeriod("custom", selectedYear, selectedMonth, selectedQuarter, customFrom, customTo);
  };

  return (
    <div style={{
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        {/* Period type selector */}
        <div style={{ display: "flex", background: "#cbd5e1", borderRadius: 8, padding: 2, gap: 2 }}>
          {(["month", "quarter", "year", "custom"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPeriodType(type)}
              style={{
                border: "none",
                background: periodType === type ? "#fff" : "transparent",
                color: periodType === type ? "#0f172a" : "#475569",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: periodType === type ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.15s"
              }}
            >
              {type === "month" && "Месяц"}
              {type === "quarter" && "Квартал"}
              {type === "year" && "Год"}
              {type === "custom" && "Интервал"}
            </button>
          ))}
        </div>

        {/* Dynamic Period controls */}
        {periodType === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString("ru", { month: "long" })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={currentYear - 2 + i} value={currentYear - 2 + i}>
                  {currentYear - 2 + i} год
                </option>
              ))}
            </select>
          </div>
        )}

        {periodType === "quarter" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value))}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            >
              <option value={1}>I Квартал</option>
              <option value={2}>II Квартал</option>
              <option value={3}>III Квартал</option>
              <option value={4}>IV Квартал</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={currentYear - 2 + i} value={currentYear - 2 + i}>
                  {currentYear - 2 + i} год
                </option>
              ))}
            </select>
          </div>
        )}

        {periodType === "year" && (
          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={currentYear - 2 + i} value={currentYear - 2 + i}>
                  {currentYear - 2 + i} год
                </option>
              ))}
            </select>
          </div>
        )}

        {periodType === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>по</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none" }}
            />
            <button
              onClick={handleCustomApply}
              style={{
                background: "#0f172a",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >
              Применить
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        {/* Account select dropdown */}
        {showAccountSelect && onChangeAccountId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Счёт</label>
            <select
              value={accountId}
              onChange={(e) => onChangeAccountId(e.target.value)}
              style={{
                width: 280,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                background: "#fff",
                outline: "none"
              }}
            >
              {allowAllAccounts && <option value="ALL">Все счета</option>}
              {!allowAllAccounts && !accountId && <option value="">Выберите счёт...</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Counterparty select dropdown */}
        {showCounterpartySelect && onChangeCounterpartyId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Контрагент</label>
            <select
              value={counterpartyId}
              onChange={(e) => onChangeCounterpartyId(e.target.value)}
              style={{
                width: 240,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                background: "#fff",
                outline: "none"
              }}
            >
              <option value="ALL">Все контрагенты</option>
              {counterparties.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} {cp.inn ? `(ИНН ${cp.inn})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Document Type select dropdown */}
        {showDocumentTypeSelect && onChangeDocumentTypeId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Тип документа</label>
            <select
              value={documentTypeId}
              onChange={(e) => onChangeDocumentTypeId(e.target.value)}
              style={{
                width: 240,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                background: "#fff",
                outline: "none"
              }}
            >
              <option value="ALL">Все типы</option>
              {docTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Subconto expand checkbox */}
        {showSubcontoCheckbox && onChangeExpandSubconto && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
            <input
              type="checkbox"
              id="expandSubcontoCheck"
              checked={expandSubconto}
              onChange={(e) => onChangeExpandSubconto(e.target.checked)}
              style={{ cursor: "pointer", width: 16, height: 16 }}
            />
            <label htmlFor="expandSubcontoCheck" style={{ fontSize: 13, color: "#334155", fontWeight: 500, cursor: "pointer" }}>
              Показать субконто (Контрагенты)
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
