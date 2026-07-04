"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type FundingType = "FULLY_PAID_CASH" | "PARTIALLY_PAID" | "PAID_IN_KIND" | "NOT_PAID";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  children?: AccountOption[];
}

const ASSET_ACCOUNT_CODE_RE = /^(0[1-9]\d{2}|1\d{3}|2\d{3})$/;

function flattenAssetAccounts(nodes: AccountOption[]): AccountOption[] {
  const out: AccountOption[] = [];
  for (const node of nodes) {
    if (ASSET_ACCOUNT_CODE_RE.test(node.code)) out.push(node);
    if (node.children?.length) out.push(...flattenAssetAccounts(node.children));
  }
  return out;
}

interface CharterCapitalModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentAmount: number | null; // null = first-time declaration
}

export default function CharterCapitalModal({ open, onClose, onSaved, currentAmount }: CharterCapitalModalProps) {
  const [amount, setAmount] = useState("");
  const [fundingType, setFundingType] = useState<FundingType>("NOT_PAID");
  const [paidAmount, setPaidAmount] = useState("");
  const [fundedAccountCode, setFundedAccountCode] = useState("");
  const [confirmedRegistration, setConfirmedRegistration] = useState(false);
  const [registrationDate, setRegistrationDate] = useState("");
  const [assetAccounts, setAssetAccounts] = useState<AccountOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isIncrease = currentAmount !== null && Number(amount) > currentAmount;

  useEffect(() => {
    if (!open) return;
    setAmount(currentAmount !== null ? String(currentAmount) : "");
    setFundingType("NOT_PAID");
    setPaidAmount("");
    setFundedAccountCode("");
    setConfirmedRegistration(false);
    setRegistrationDate("");
    setError(null);

    fetch("/v2/api/accounts")
      .then((res) => res.json())
      .then((data) => setAssetAccounts(flattenAssetAccounts(Array.isArray(data) ? data : [])))
      .catch(() => setAssetAccounts([]));
  }, [open, currentAmount]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Укажите положительную сумму уставного капитала");
      return;
    }
    if (currentAmount !== null && amountNum < currentAmount) {
      setError("Уменьшение уставного капитала требует отдельной бухгалтерской операции, обратитесь к бухгалтеру");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { amount: amountNum, fundingType };
      if (fundingType === "PARTIALLY_PAID" || fundingType === "PAID_IN_KIND") {
        body.paidAmount = Number(paidAmount);
      }
      if (fundingType === "PAID_IN_KIND") {
        body.fundedAccountCode = fundedAccountCode;
      }
      if (isIncrease) {
        body.confirmedRegistration = confirmedRegistration;
        body.registrationDate = registrationDate;
      }

      const res = await fetch("/v2/api/settings/charter-capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 shadow-xl w-full max-w-md rounded p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Уставный капитал</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={14} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Сумма по уставу *</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
              required
            />
            <span className="text-sm text-gray-500 shrink-0">сум</span>
          </div>
        </div>

        {currentAmount === null && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">На сегодня капитал</label>
            {(
              [
                { value: "FULLY_PAID_CASH", label: "Полностью оплачен деньгами" },
                { value: "PARTIALLY_PAID", label: "Оплачен частично" },
                { value: "PAID_IN_KIND", label: "Оплачен имуществом" },
                { value: "NOT_PAID", label: "Ещё не оплачен (учредитель должен компании)" },
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="fundingType"
                  checked={fundingType === opt.value}
                  onChange={() => setFundingType(opt.value)}
                  className="text-black focus:ring-black"
                />
                {opt.label}
              </label>
            ))}

            {fundingType === "PARTIALLY_PAID" && (
              <div className="ml-6 flex items-center gap-2">
                <span className="text-xs text-gray-500">Сумма:</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-40 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-black"
                  required
                />
                <span className="text-xs text-gray-500">сум</span>
              </div>
            )}

            {fundingType === "PAID_IN_KIND" && (
              <div className="ml-6 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Сумма имущества:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-40 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-black"
                    required
                  />
                  <span className="text-xs text-gray-500">сум</span>
                </div>
                <select
                  value={fundedAccountCode}
                  onChange={(e) => setFundedAccountCode(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-black bg-white"
                  required
                >
                  <option value="">— Выберите счёт актива —</option>
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {isIncrease && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
            <label className="flex items-start gap-2 text-xs text-amber-900 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedRegistration}
                onChange={(e) => setConfirmedRegistration(e.target.checked)}
                className="mt-0.5"
                required
              />
              Подтверждаю: есть решение учредителей и изменения устава зарегистрированы
            </label>
            <div>
              <label className="block text-xs text-amber-900 font-medium mb-1">Дата регистрации изменений</label>
              <input
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm border border-gray-200 text-gray-700 font-medium py-2 px-4 rounded hover:bg-gray-50 transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm bg-black text-white font-bold py-2 px-5 rounded hover:opacity-80 transition disabled:opacity-40"
          >
            {submitting ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
