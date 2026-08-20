"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

// Настройки «Расчёта налога на прибыль»: метод себестоимости (фиксируется на
// налоговый год, ТЗ 0.3), льгота IT Park (Фаза 1 эпика — только поля, ТЗ 7.1)
// и среднегодовая численность (поля шапки формы my.soliq.uz).

interface CostingHistoryRow { fiscalYear: number; costingMethod: "PROPORTIONAL" | "DIRECT"; setAt: string }
interface CostingState { year: number; effectiveMethod: "PROPORTIONAL" | "DIRECT" | null; history: CostingHistoryRow[] }

interface TaxOrgSettings {
  taxBenefit: "NONE" | "IT_PARK_RESIDENT";
  itParkResidentSince: string | null;
  itParkCertificateNumber: string | null;
  avgHeadcount: number;
  avgHeadcountDisabled: number;
}

const METHOD_LABEL: Record<string, string> = {
  PROPORTIONAL: "Пропорциональный (по сумме прямых затрат)",
  DIRECT: "Прямой (по статьям прямых затрат)",
};

export default function ProfitTaxSettingsPage() {
  const currentYear = new Date().getFullYear();

  const [costing, setCosting] = useState<CostingState | null>(null);
  const [newMethod, setNewMethod] = useState<"PROPORTIONAL" | "DIRECT">("PROPORTIONAL");
  const [newYear, setNewYear] = useState(currentYear);

  const [org, setOrg] = useState<TaxOrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cRes, oRes] = await Promise.all([
        fetch(`/v2/api/settings/costing-method?year=${currentYear}`),
        fetch("/v2/api/settings/org"),
      ]);
      const c = await cRes.json();
      const o = await oRes.json();
      if (!c.error) setCosting(c);
      if (!o.error) setOrg({
        taxBenefit: o.taxBenefit ?? "NONE",
        itParkResidentSince: o.itParkResidentSince ? o.itParkResidentSince.slice(0, 10) : null,
        itParkCertificateNumber: o.itParkCertificateNumber ?? null,
        avgHeadcount: o.avgHeadcount ?? 1,
        avgHeadcountDisabled: o.avgHeadcountDisabled ?? 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const fixMethod = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/v2/api/settings/costing-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear: newYear, costingMethod: newMethod }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: json.error || `Ошибка ${res.status}` });
      } else {
        setMessage({ kind: "ok", text: `Метод на ${newYear} год зафиксирован.` });
        await loadAll();
      }
    } catch (e: any) {
      setMessage({ kind: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const saveOrg = async () => {
    if (!org) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/v2/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxBenefit: org.taxBenefit,
          itParkResidentSince: org.itParkResidentSince || null,
          itParkCertificateNumber: org.itParkCertificateNumber || null,
          avgHeadcount: org.avgHeadcount,
          avgHeadcountDisabled: org.avgHeadcountDisabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) setMessage({ kind: "err", text: json.error || `Ошибка ${res.status}` });
      else setMessage({ kind: "ok", text: "Настройки сохранены." });
    } catch (e: any) {
      setMessage({ kind: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500 text-sm">Загрузка настроек налога на прибыль...</div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Налог на прибыль — настройки</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Параметры «Расчёта налога на прибыль» (my.soliq.uz): метод себестоимости, льготы, численность
        </p>
      </div>

      {message && (
        <div className={`rounded p-3 text-xs font-medium border ${message.kind === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {/* Метод себестоимости */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-black text-gray-800">Метод определения себестоимости</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Выбирается один раз и фиксируется на весь налоговый год. Смена возможна только с нового
            года после полного закрытия предыдущего. От метода зависит, какое приложение годового
            отчёта заполняется: №2.1(а) — прямой, №2.1(б) — пропорциональный.
          </p>
        </div>

        <div className="text-xs text-gray-700">
          Действующий метод в {costing?.year ?? currentYear}:{" "}
          <span className="font-black">
            {costing?.effectiveMethod ? METHOD_LABEL[costing.effectiveMethod] : "не зафиксирован"}
          </span>
        </div>

        {costing && costing.history.length > 0 && (
          <table className="w-full text-[11px] border border-gray-100 rounded">
            <thead>
              <tr className="bg-gray-50 text-gray-400 font-semibold">
                <th className="p-2 text-left">Налоговый год</th>
                <th className="p-2 text-left">Метод</th>
                <th className="p-2 text-left">Зафиксирован</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costing.history.map(h => (
                <tr key={h.fiscalYear}>
                  <td className="p-2 font-mono">{h.fiscalYear}</td>
                  <td className="p-2">{METHOD_LABEL[h.costingMethod]}</td>
                  <td className="p-2">{new Date(h.setAt).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400">Налоговый год</label>
            <input type="number" value={newYear} min={2020} max={2100}
              onChange={e => setNewYear(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs w-24 outline-hidden focus:border-black" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400">Метод</label>
            <SearchableSelect
              options={[
                { value: "PROPORTIONAL", label: METHOD_LABEL.PROPORTIONAL },
                { value: "DIRECT", label: METHOD_LABEL.DIRECT },
              ]}
              value={newMethod}
              onChange={v => setNewMethod(v as any)}
              className="min-w-[260px]"
            />
          </div>
          <button onClick={fixMethod} disabled={saving}
            className="bg-gray-900 text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-gray-700 disabled:opacity-50">
            Зафиксировать метод
          </button>
        </div>
      </div>

      {/* Льгота IT Park + численность */}
      {org && (
        <div className="bg-white border border-gray-200 rounded shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-black text-gray-800">Льготы и параметры формы</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Резидентство IT Park — пока только настройка (полная логика льгот по всем налоговым
              модулям — отдельный эпик). Численность попадает в шапку печатной формы.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400">Налоговая льгота</label>
              <SearchableSelect
                options={[
                  { value: "NONE", label: "Нет льгот" },
                  { value: "IT_PARK_RESIDENT", label: "Резидент IT Park Uzbekistan" },
                ]}
                value={org.taxBenefit}
                onChange={v => setOrg({ ...org, taxBenefit: v as any })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400">Дата регистрации резидентства</label>
              <input type="date" value={org.itParkResidentSince ?? ""}
                disabled={org.taxBenefit === "NONE"}
                onChange={e => setOrg({ ...org, itParkResidentSince: e.target.value || null })}
                className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black disabled:bg-gray-50 disabled:text-gray-300" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400">Номер сертификата резидента</label>
              <input type="text" value={org.itParkCertificateNumber ?? ""}
                disabled={org.taxBenefit === "NONE"}
                onChange={e => setOrg({ ...org, itParkCertificateNumber: e.target.value || null })}
                className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black disabled:bg-gray-50 disabled:text-gray-300" />
            </div>
            <div />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400">Среднегодовая численность работников</label>
              <input type="number" min={0} value={org.avgHeadcount}
                onChange={e => setOrg({ ...org, avgHeadcount: Number(e.target.value) })}
                className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400">в т.ч. лица с инвалидностью</label>
              <input type="number" min={0} value={org.avgHeadcountDisabled}
                onChange={e => setOrg({ ...org, avgHeadcountDisabled: Number(e.target.value) })}
                className="bg-white border border-gray-200 rounded px-2.5 py-1.5 outline-hidden focus:border-black" />
            </div>
          </div>

          <button onClick={saveOrg} disabled={saving}
            className="flex items-center gap-1.5 bg-gray-900 text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-gray-700 disabled:opacity-50">
            <Save size={13} /> Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
