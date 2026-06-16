import React from "react";

export function formatReportSum(val: number): React.ReactNode {
  if (val === 0 || val === null || val === undefined || Math.abs(val) < 0.005) {
    return <span style={{ color: "#94a3b8" }}>—</span>;
  }
  
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Math.abs(val));

  if (val < 0) {
    return <span style={{ color: "#ef4444" }}>({formatted})</span>;
  }

  return <span>{formatted}</span>;
}

export function formatDateStr(date: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}
