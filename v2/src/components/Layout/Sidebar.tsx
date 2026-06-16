"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  BarChart2,
  ListTree,
  Clock,
  CalendarCheck,
  Settings2,
  LogOut,
  FileText,
  BookText,
  CreditCard,
  BookOpen,
  Layers,
  Scale,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/transactions", label: "Транзакции", icon: ArrowLeftRight },
  { href: "/cashflow", label: "Cash Flow", icon: TrendingUp },
  { href: "/pnl", label: "P&L", icon: BarChart2 },
  { href: "/accounts", label: "Счета", icon: ListTree },
  { href: "/open-positions", label: "Открытые позиции", icon: Clock },
  { href: "/closing", label: "Закрытие месяца", icon: CalendarCheck },
  { href: "/settings/rules", label: "Правила классификации", icon: Settings2 },
];

const REPORTS_NAV = [
  { href: "/reports/osv", label: "ОСВ", icon: Layers },
  { href: "/reports/journal", label: "Журнал проводок", icon: BookText },
  { href: "/reports/account-card", label: "Карточка счёта", icon: CreditCard },
  { href: "/reports/account-analysis", label: "Анализ счёта", icon: FileText },
  { href: "/reports/subconto", label: "Анализ субконто", icon: BookOpen },
  { href: "/reports/balance", label: "Баланс (Форма №1)", icon: Scale },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

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

      {/* Bottom: logout */}
      <div className="p-4 border-t border-[#E5E7EB]">
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
