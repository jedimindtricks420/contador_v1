import { z } from "zod";

export class InvalidReportPeriod extends Error {}

export function reportPeriod(from: string | null, to: string | null, now = new Date()) {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tashkent", year: "numeric" }).format(now);
  const fromDay = from ?? `${year}-01-01`;
  const toDay = to ?? `${year}-12-31`;
  if (!z.iso.date().safeParse(fromDay).success || !z.iso.date().safeParse(toDay).success) {
    throw new InvalidReportPeriod("Неверная дата: требуется YYYY-MM-DD");
  }
  if (fromDay > toDay) {
    throw new InvalidReportPeriod("Начало периода позже его окончания");
  }
  const startDate = new Date(`${fromDay}T00:00:00+05:00`);
  const endExclusive = new Date(new Date(`${toDay}T00:00:00+05:00`).getTime() + 86_400_000);
  const endDate = new Date(endExclusive.getTime() - 1);
  const months: string[] = [];
  const cursor = new Date(`${fromDay.slice(0, 7)}-01T00:00:00Z`);
  const lastMonth = toDay.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= lastMonth) {
    months.push(cursor.toISOString().slice(0, 7));
    if (cursor.toISOString().slice(0, 7) === lastMonth) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { startDate, endDate, endExclusive, months };
}