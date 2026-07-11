"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  BarChart2,
  ListTree,
  Clock,
  CalendarCheck,
  Files,
  Settings2,
  LogOut,
  FileText,
  BookText,
  CreditCard,
  BookOpen,
  Layers,
  Scale,
  User,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Building2,
  Percent,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/transactions", label: "Транзакции", icon: ArrowLeftRight },
  { href: "/cashflow", label: "Cash Flow", icon: TrendingUp },
  { href: "/accounts", label: "Счета", icon: ListTree },
  { href: "/open-positions", label: "Открытые позиции", icon: Clock },
  { href: "/closing", label: "Закрытие месяца", icon: CalendarCheck },
  { href: "/documents", label: "Документы", icon: Files },
  { href: "/settings/rules", label: "Настройки", icon: Settings2 },
];

const REPORTS_NAV = [
  { href: "/reports/osv", label: "ОСВ", icon: Layers },
  { href: "/reports/journal", label: "Журнал проводок", icon: BookText },
  { href: "/reports/account-card", label: "Карточка счёта", icon: CreditCard },
  { href: "/reports/account-analysis", label: "Анализ счёта", icon: FileText },
  { href: "/reports/subconto", label: "Анализ субконто", icon: BookOpen },
  { href: "/balance", label: "Форма №1 — Баланс", icon: Scale },
  { href: "/pnl", label: "Форма №2 — Финрезультаты", icon: BarChart2 },
  { href: "/tax-dashboard", label: "Налог на прибыль", icon: Percent },
];

interface Membership {
  orgId: string;
  orgName: string;
  role: string;
}

interface MeData {
  user: { id: string; email: string; name: string | null };
  organization: { id: string; name: string } | null;
  role: string | null;
  memberships: Membership[];
}

export default function Sidebar() {
  const pathname = usePathname();

  const [me, setMe] = useState<MeData | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);
  const [addingOrg, setAddingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgInn, setNewOrgInn] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    fetch("/v2/api/user/me")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMe(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOrgOpen(false);
        setAddingOrg(false);
        setOrgError(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const switchOrg = async (orgId: string) => {
    setOrgLoading(true);
    await fetch("/v2/api/user/active-org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    window.location.reload();
  };

  const createOrg = async () => {
    if (!newOrgName.trim()) return;
    setOrgLoading(true);
    setOrgError(null);
    const res = await fetch("/v2/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newOrgName, inn: newOrgInn }),
    });
    const data = await res.json();
    if (res.ok) {
      window.location.reload();
    } else {
      setOrgError(data.error || "Ошибка создания");
      setOrgLoading(false);
    }
  };

  const deleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Удалить организацию "${orgName}"?\n\nВсе данные будут удалены безвозвратно.`)) return;
    setOrgLoading(true);
    setOrgError(null);
    const res = await fetch(`/v2/api/orgs/${orgId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      window.location.reload();
    } else {
      setOrgError(data.error || "Ошибка удаления");
      setOrgLoading(false);
    }
  };

  const activeOrgId = me?.organization?.id ?? null;
  const activeOrgName = me?.organization?.name ?? "…";

  return (
    <div className="w-64 h-screen bg-[#F9FAFB] border-r border-[#E5E7EB] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#E5E7EB]">
        <img
          src="/v2/contador text logo.svg"
          alt="Contador"
          className="h-7 w-auto"
        />
      </div>

      {/* Org switcher */}
      <div className="px-4 pt-3 pb-2 border-b border-[#E5E7EB]" ref={dropdownRef}>
        <button
          onClick={() => { setOrgOpen((v) => !v); setAddingOrg(false); setOrgError(null); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
        >
          <Building2 size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
          <span className="flex-1 text-sm font-medium text-gray-800 truncate">{activeOrgName}</span>
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`text-gray-400 flex-shrink-0 transition-transform ${orgOpen ? "rotate-180" : ""}`}
          />
        </button>

        {orgOpen && (
          <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 relative">
            {/* Memberships list */}
            {me?.memberships.map((m) => {
              const isCurrentOrg = m.orgId === activeOrgId;
              return (
                <div key={m.orgId} className="flex items-center group">
                  <button
                    onClick={() => !isCurrentOrg && switchOrg(m.orgId)}
                    disabled={orgLoading || isCurrentOrg}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                      isCurrentOrg ? "cursor-default" : "hover:bg-gray-50 cursor-pointer"
                    } disabled:opacity-60`}
                  >
                    {isCurrentOrg ? (
                      <Check size={13} strokeWidth={2.5} className="text-black flex-shrink-0" />
                    ) : (
                      <span className="w-[13px] flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${isCurrentOrg ? "font-semibold text-black" : "text-gray-600"}`}>
                      {m.orgName}
                    </span>
                  </button>
                  {isCurrentOrg && me.memberships.length > 1 && m.role === "OWNER" && (
                    <button
                      onClick={() => deleteOrg(m.orgId, m.orgName)}
                      disabled={orgLoading}
                      title="Удалить организацию"
                      className="p-2 mr-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="border-t border-gray-100" />

            {!addingOrg ? (
              <button
                onClick={() => setAddingOrg(true)}
                disabled={orgLoading}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 hover:text-black hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={2} />
                <span>Добавить организацию</span>
              </button>
            ) : (
              <div className="p-3 space-y-2">
                {orgError && (
                  <p className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1">{orgError}</p>
                )}
                <input
                  autoFocus
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createOrg()}
                  placeholder="Название организации"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-black transition-colors"
                  disabled={orgLoading}
                />
                <input
                  type="text"
                  value={newOrgInn}
                  onChange={(e) => setNewOrgInn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createOrg()}
                  placeholder="ИНН (необязательно)"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-black transition-colors"
                  disabled={orgLoading}
                />
                <div className="flex gap-2">
                  <button
                    onClick={createOrg}
                    disabled={orgLoading || !newOrgName.trim()}
                    className="flex-1 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    {orgLoading ? "…" : "Создать"}
                  </button>
                  <button
                    onClick={() => {
                      setAddingOrg(false);
                      setOrgError(null);
                      setNewOrgName("");
                      setNewOrgInn("");
                    }}
                    className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                active
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-black hover:bg-gray-100"
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Reports section */}
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-5 pb-1.5">
          Для бухгалтера
        </div>
        {REPORTS_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                active
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-black hover:bg-gray-100"
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: profile + logout */}
      <div className="p-4 border-t border-[#E5E7EB] space-y-0.5">
        <Link
          href="/profile"
          className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
            isActive("/profile")
              ? "bg-white text-black shadow-sm"
              : "text-gray-500 hover:text-black hover:bg-gray-100"
          }`}
        >
          <User size={18} strokeWidth={1.5} />
          <span>Профиль</span>
        </Link>
        <form action="/v2/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50/50 rounded transition-all"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span>Выйти</span>
          </button>
        </form>
      </div>
    </div>
  );
}
