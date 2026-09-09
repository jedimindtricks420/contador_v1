"use client";

// Тонкий адаптер аналитики. Ни один реальный измерительный ID здесь не
// зашивается: если на странице подключён gtag (Google tag / GA4, обычно через
// NEXT_PUBLIC_GTAG_ID — счётчик подключает владелец при выпуске, см. README
// маркетингового приложения) или dataLayer, событие уходит туда; если ничего
// не подключено — вызов no-op и не бросает ошибку. Второй дублирующий счётчик
// не создаётся (раздел 9 задачи).
//
// События и допустимые параметры — раздел 9 TASK-0003: seo_cta_click,
// guide_to_feature_click, tool_calculation_success, checklist_complete,
// share_link_click, registration_success. Суммы, категории транзакций,
// реквизиты и содержимое выписок никогда не передаются.

export type AnalyticsEventName =
  | "seo_cta_click"
  | "guide_to_feature_click"
  | "tool_calculation_success"
  | "checklist_complete"
  | "share_link_click"
  | "registration_success";

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(name: AnalyticsEventName, params: AnalyticsParams = {}): void {
  if (typeof window === "undefined") return;

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
      return;
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...params });
    }
    // Ни gtag, ни dataLayer не подключены — тихий no-op (например, локальная
    // сборка/preview без счётчика).
  } catch {
    // Аналитика никогда не должна ломать страницу пользователю.
  }
}
