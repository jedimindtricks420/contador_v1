"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BookText, 
  TableProperties, 
  Scale, 
  FileText, 
  Users, 
  Settings2,
  LogOut,
  ListTree,
  Building2,
  CreditCard
} from "lucide-react";
import { OrgSwitcher } from "../OrgSwitcher";

const menuItems = [
  { name: "Дашборд", href: "/", icon: LayoutDashboard },
  { name: "Журнал операций", href: "/journal", icon: BookText },
  { name: "ОСВ", href: "/osv", icon: TableProperties },
  { name: "Баланс", href: "/balance", icon: Scale },
  { name: "ОФР", href: "/pnl", icon: FileText },
  { name: "Контрагенты", href: "/counterparties", icon: Users },
  { name: "Счета", href: "/settings/accounts", icon: ListTree },
  { name: "Система", href: "/settings", icon: Settings2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-[#F9FAFB] border-r border-[#E5E7EB] flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-[#E5E7EB]">
        <img
          src="/contador text logo.svg"
          alt="Contador"
          className="h-8 w-auto"
        />
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                isActive 
                  ? "bg-white text-black shadow-sm" 
                  : "text-gray-500 hover:text-black hover:bg-gray-100"
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-[#E5E7EB] space-y-2">
        <OrgSwitcher />

        <Link
          href="/settings/organizations"
          className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded transition-all ${
            pathname === "/settings/organizations"
              ? "bg-black text-white shadow-sm"
              : "text-gray-400 hover:text-black hover:bg-gray-50"
          }`}
        >
          <Building2 size={18} strokeWidth={1.5} />
          <span>Мои компании</span>
        </Link>

        <Link
          href="/settings/subscription"
          className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded transition-all ${
            pathname === "/settings/subscription"
              ? "bg-black text-white shadow-sm"
              : "text-gray-400 hover:text-black hover:bg-gray-50"
          }`}
        >
          <CreditCard size={18} strokeWidth={1.5} />
          <span>Тариф</span>
        </Link>
        
        <button
          onClick={async () => {
            if(confirm("Вы действительно хотите выйти?")) {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
            }
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50/50 rounded transition-all"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );
}
