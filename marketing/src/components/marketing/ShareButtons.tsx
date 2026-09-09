"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/manifest";

interface ShareButtonsProps {
  topicId: string;
  locale: Locale;
  /** Абсолютный канонический URL страницы — единственное, что уходит в шаринг. */
  url: string;
  /** Нейтральное название инструмента/страницы, без значений полей и результата. */
  title: string;
}

// TASK-0003 §7 "Добровольное распространение": делимся ТОЛЬКО каноническим
// URL и нейтральным названием — никогда не значениями полей, результатом
// расчёта или состоянием чек-листа (ни в query, ни в тексте, ни в аналитике).
export function ShareButtons({ topicId, locale, url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  async function handleCopy() {
    trackEvent("share_link_click", { topic_id: topicId, locale, channel: "copy_link" });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен (например, нет разрешения) — молча не падаем,
      // ссылка всё равно видна и копируется вручную.
    }
  }

  function handleTelegramClick() {
    trackEvent("share_link_click", { topic_id: topicId, locale, channel: "telegram" });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 no-print">
      <button type="button" onClick={handleCopy} className="btn-outline">
        {copied
          ? locale === "ru"
            ? "Ссылка скопирована"
            : "Havola nusxalandi"
          : locale === "ru"
            ? "Скопировать ссылку"
            : "Havolani nusxalash"}
      </button>
      <a href={telegramHref} target="_blank" rel="noopener noreferrer" className="btn-outline" onClick={handleTelegramClick}>
        Telegram
      </a>
    </div>
  );
}
