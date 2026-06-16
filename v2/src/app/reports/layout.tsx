import { getActiveOrgId } from "@/lib/context";
import ClientLayout from "@/components/Layout/ClientLayout";
import ReportsTabNav from "@/components/reports/ReportsTabNav";
import React from "react";

export default async function ReportsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  try {
    await getActiveOrgId();
  } catch (err) {
    return (
      <ClientLayout>
        <div style={{ padding: 32, textAlign: "center", color: "#ef4444", fontWeight: 600 }}>
          Не авторизован или нет доступа к организации
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Бухгалтерские отчёты
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0 0" }}>
            Профессиональные отчёты в соответствии с НСБУ РУз
          </p>
        </div>

        <ReportsTabNav />

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #f1f5f9",
            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
            padding: 24
          }}
        >
          {children}
        </div>
      </div>
    </ClientLayout>
  );
}
