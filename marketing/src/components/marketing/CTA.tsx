"use client";

import { trackEvent } from "@/lib/analytics";
import { APP_LOGIN_URL, APP_REGISTER_URL } from "@/lib/site";
import type { Locale } from "@/lib/manifest";

interface CTAProps {
  topicId: string;
  locale: Locale;
  /** Где на странице расположена кнопка — для параметра cta_location события. */
  location: "hero" | "bottom" | "header" | "pricing";
  /** Показать вторичную кнопку "Войти" рядом с основной. */
  withLogin?: boolean;
  className?: string;
}

// Базовый CTA во всём разделе — TASK-0003 §6 "CTA и доверие": текст кнопки
// фиксирован ("Создать аккаунт" / "Hisob yaratish"), цель — действующая
// регистрация /v2/register. Других целей перехода (телефон, демо-звонок,
// произвольный returnUrl) в коде нет и не добавляется.
export function CTA({ topicId, locale, location, withLogin, className }: CTAProps) {
  const label = locale === "ru" ? "Создать аккаунт" : "Hisob yaratish";
  const loginLabel = locale === "ru" ? "Войти" : "Kirish";
  const helper =
    locale === "ru"
      ? "Дальше — вход в личный кабинет и подключение первой организации."
      : "Keyingi qadam — shaxsiy kabinetga kirish va birinchi tashkilotni ulash.";

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <a
          href={APP_REGISTER_URL}
          className="btn-black"
          onClick={() =>
            trackEvent("seo_cta_click", {
              topic_id: topicId,
              locale,
              cta_location: location,
              target_type: "register",
            })
          }
        >
          {label}
        </a>
        {withLogin && (
          <a
            href={APP_LOGIN_URL}
            className="btn-outline"
            onClick={() =>
              trackEvent("seo_cta_click", {
                topic_id: topicId,
                locale,
                cta_location: location,
                target_type: "login",
              })
            }
          >
            {loginLabel}
          </a>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">{helper}</p>
    </div>
  );
}
