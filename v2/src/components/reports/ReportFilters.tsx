"use client";
import { useState, useEffect } from "react";
import SearchableSelect from "@/components/SearchableSelect";

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
            <div style={{ width: 160 }}>
              <SearchableSelect
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: new Date(2000, i, 1).toLocaleString("ru", { month: "long" }),
                }))}
                value={String(selectedMonth)}
                onChange={(v) => setSelectedMonth(Number(v))}
              />
            </div>
            <div style={{ width: 120 }}>
              <SearchableSelect
                options={Array.from({ length: 5 }, (_, i) => ({
                  value: String(currentYear - 2 + i),
                  label: `${currentYear - 2 + i} год`,
                }))}
                value={String(selectedYear)}
                onChange={(v) => setSelectedYear(Number(v))}
              />
            </div>
          </div>
        )}

        {periodType === "quarter" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 140 }}>
              <SearchableSelect
                options={[
                  { value: "1", label: "I Квартал" },
                  { value: "2", label: "II Квартал" },
                  { value: "3", label: "III Квартал" },
                  { value: "4", label: "IV Квартал" },
                ]}
                value={String(selectedQuarter)}
                onChange={(v) => setSelectedQuarter(Number(v))}
              />
            </div>
            <div style={{ width: 120 }}>
              <SearchableSelect
                options={Array.from({ length: 5 }, (_, i) => ({
                  value: String(currentYear - 2 + i),
                  label: `${currentYear - 2 + i} год`,
                }))}
                value={String(selectedYear)}
                onChange={(v) => setSelectedYear(Number(v))}
              />
            </div>
          </div>
        )}

        {periodType === "year" && (
          <div style={{ width: 120 }}>
            <SearchableSelect
              options={Array.from({ length: 5 }, (_, i) => ({
                value: String(currentYear - 2 + i),
                label: `${currentYear - 2 + i} год`,
              }))}
              value={String(selectedYear)}
              onChange={(v) => setSelectedYear(Number(v))}
            />
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
            <div style={{ width: 280 }}>
              <SearchableSelect
                options={accounts.map((acc) => ({ value: acc.id, label: `${acc.code} — ${acc.name}`, searchText: acc.code }))}
                value={accountId}
                onChange={onChangeAccountId}
                allOption={allowAllAccounts ? { value: "ALL", label: "Все счета" } : undefined}
                placeholder={!allowAllAccounts ? "Выберите счёт..." : undefined}
              />
            </div>
          </div>
        )}

        {/* Counterparty select dropdown */}
        {showCounterpartySelect && onChangeCounterpartyId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Контрагент</label>
            <div style={{ width: 240 }}>
              <SearchableSelect
                options={counterparties.map((cp) => ({
                  value: cp.id,
                  label: `${cp.name} ${cp.inn ? `(ИНН ${cp.inn})` : ""}`,
                  searchText: cp.inn ?? undefined,
                }))}
                value={counterpartyId}
                onChange={onChangeCounterpartyId}
                allOption={{ value: "ALL", label: "Все контрагенты" }}
              />
            </div>
          </div>
        )}

        {/* Document Type select dropdown */}
        {showDocumentTypeSelect && onChangeDocumentTypeId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Тип документа</label>
            <div style={{ width: 240 }}>
              <SearchableSelect
                options={docTypes.map((type) => ({ value: type.id, label: type.name }))}
                value={documentTypeId}
                onChange={onChangeDocumentTypeId}
                allOption={{ value: "ALL", label: "Все типы" }}
              />
            </div>
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
