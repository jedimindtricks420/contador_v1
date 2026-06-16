"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ReportsTabNav() {
  const pathname = usePathname();

  const tabs = [
    { name: "ОСВ", href: "/reports/osv" },
    { name: "Карточка счёта", href: "/reports/account-card" },
    { name: "Анализ счёта", href: "/reports/account-analysis" },
    { name: "Журнал проводок", href: "/reports/journal" },
    { name: "Анализ субконто", href: "/reports/subconto" }
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: 24, overflowX: "auto" }}>
      <nav style={{ display: "flex", gap: 24, paddingBottom: 8 }}>
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                fontSize: "13px",
                fontWeight: active ? 700 : 500,
                color: active ? "#111827" : "#6b7280",
                borderBottom: active ? "2px solid #111827" : "2px solid transparent",
                paddingBottom: 8,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
