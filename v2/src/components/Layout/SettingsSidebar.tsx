"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Building2, 
  GitBranch, 
  BookOpen, 
  CalendarDays, 
  AlertCircle,
  Users
} from "lucide-react";

export function SettingsSidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/settings", label: "Настройки организации", icon: Building2 },
    { href: "/settings/rules", label: "Правила классификации", icon: GitBranch },
    { href: "/settings/accounts", label: "Справочники счетов", icon: BookOpen },
    { href: "/settings/tax-calendar", label: "Налоговый календарь", icon: CalendarDays },
    { href: "/settings/open-items-deadlines", label: "Риски открытых позиций", icon: AlertCircle },
    { href: "/settings/members", label: "Участники организации", icon: Users },
  ];

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] overflow-y-auto">
      <div className="p-6">
        <h2 className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-4">
          Управление
        </h2>
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/settings" && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-black shadow-sm"
                    : "text-gray-500 hover:text-black hover:bg-gray-100"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-black" : "text-gray-400"}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
