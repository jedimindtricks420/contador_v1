"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";
import { ShareButtons } from "@/components/marketing/ShareButtons";
import type { Locale } from "@/lib/manifest";

// 10 пунктов чек-листа закрытия месяца — TASK-0003 §7 "21. Чек-лист", текст
// зафиксирован в задаче дословно на обоих языках, менять здесь нельзя без
// обновления задачи и LIST_VERSION ниже.
const ITEMS_RU = [
  "Выбран правильный период учёта",
  "Собраны выписки по нужным счетам",
  "Проверена полнота загруженных операций",
  "Разобраны повторные и ошибочные строки",
  "Проверены предложенные категории",
  "Уточнены неоднозначные операции",
  "Проверены проводки по документам",
  "Просмотрены авансы и открытые позиции",
  "Проверены остатки и доступные отчёты",
  "Результаты проверены перед закрытием периода",
] as const;

const ITEMS_UZ = [
  "To‘g‘ri hisob davri tanlangan",
  "Kerakli hisobvaraqlar ko‘chirmalari yig‘ilgan",
  "Yuklangan operatsiyalar to‘liqligi tekshirilgan",
  "Takroriy va xato satrlar tekshirilgan",
  "Tavsiya etilgan toifalar tekshirilgan",
  "Noaniq operatsiyalar aniqlashtirilgan",
  "Hujjatlar bo‘yicha o‘tkazmalar tekshirilgan",
  "Avanslar va ochiq pozitsiyalar ko‘rib chiqilgan",
  "Qoldiqlar va mavjud hisobotlar tekshirilgan",
  "Davrni yopishdan oldin natijalar tekshirilgan",
] as const;

// Версия состава пунктов — хранится вместе с отметками в localStorage. Если
// список когда-нибудь изменится, версия увеличивается и старое сохранённое
// состояние с несовпадающей версией отбрасывается вместо того, чтобы
// показать отметки не на своих местах.
const LIST_VERSION = 1;
const STORAGE_KEY = "contador_checklist_zakrytie_mesyaca";

interface StoredState {
  version: number;
  // Только булевы отметки по индексу пункта — никаких свободных полей с
  // данными компании (TASK-0003 §7).
  checked: boolean[];
}

function emptyChecked(): boolean[] {
  return new Array(ITEMS_RU.length).fill(false);
}

// Небольшой внешний стор поверх localStorage через useSyncExternalStore.
// Читать localStorage прямо в теле useState/useEffect и синхронно звать
// setState на монтировании — паттерн, который новый eslint-plugin-react-hooks
// (react-hooks/set-state-in-effect) считает антипаттерном именно потому, что
// он же ломает гидратацию (сервер не знает localStorage). useSyncExternalStore —
// штатное решение React для внешних источников состояния: getServerSnapshot
// для SSR/первого клиентского рендера, getSnapshot — для реального значения
// сразу после гидратации, без ручного setState в эффекте.
let cachedSnapshot: boolean[] = emptyChecked();
let storeInitialized = false;
const listeners = new Set<() => void>();

function readFromStorage(): boolean[] {
  if (typeof window === "undefined") return emptyChecked();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyChecked();
    const parsed = JSON.parse(raw) as StoredState;
    if (
      parsed.version !== LIST_VERSION ||
      !Array.isArray(parsed.checked) ||
      parsed.checked.length !== ITEMS_RU.length
    ) {
      return emptyChecked();
    }
    return parsed.checked.map(Boolean);
  } catch {
    return emptyChecked();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean[] {
  if (!storeInitialized) {
    storeInitialized = true;
    cachedSnapshot = readFromStorage();
  }
  return cachedSnapshot;
}

function getServerSnapshot(): boolean[] {
  return emptyChecked();
}

function writeChecklist(next: boolean[]) {
  cachedSnapshot = next;
  storeInitialized = true;
  try {
    const payload: StoredState = { version: LIST_VERSION, checked: next };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — чек-лист остаётся
    // рабочим в рамках текущей сессии, просто без сохранения между визитами.
  }
  listeners.forEach((listener) => listener());
}

const T = {
  ru: {
    progress: (n: number) => `Готово: ${n} из ${ITEMS_RU.length}`,
    reset: "Сбросить",
    resetConfirm: "Сбросить все отметки чек-листа? Это действие нельзя отменить.",
    print: "Распечатать",
    caption: "Рабочий список проверок; состав обязательных действий зависит от вашего учёта",
    shareTitle: "Чек-лист закрытия месяца — Contador",
  },
  uz: {
    progress: (n: number) => `Bajarildi: ${n} / ${ITEMS_UZ.length}`,
    reset: "Tozalash",
    resetConfirm: "Tekshiruv ro‘yxatidagi barcha belgilarni tozalaysizmi? Bu amalni bekor qilib bo‘lmaydi.",
    print: "Chop etish",
    caption: "Ishchi tekshiruv ro‘yxati; zarur amallar hisobingizga bog‘liq",
    shareTitle: "Oyni yopish uchun tekshiruv ro‘yxati — Contador",
  },
} as const;

export function ChecklistWidget({ locale, topicId, canonicalUrl }: { locale: Locale; topicId: string; canonicalUrl: string }) {
  const items = locale === "ru" ? ITEMS_RU : ITEMS_UZ;
  const t = T[locale];
  const checked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // null = ещё не оценивали в этом монтировании. Первый прогон эффекта после
  // гидратации фиксирует "уже было завершено раньше" и НЕ шлёт событие —
  // checklist_complete должно означать "впервые достигнуты 10/10 за сессию".
  const trackedCompleteRef = useRef<boolean | null>(null);
  const doneCount = checked.filter(Boolean).length;

  useEffect(() => {
    if (trackedCompleteRef.current === null) {
      trackedCompleteRef.current = doneCount === items.length;
      return;
    }
    if (doneCount === items.length && !trackedCompleteRef.current) {
      trackedCompleteRef.current = true;
      trackEvent("checklist_complete", { topic_id: topicId, locale });
    } else if (doneCount < items.length) {
      trackedCompleteRef.current = false;
    }
  }, [doneCount, items.length, topicId, locale]);

  function toggle(index: number) {
    const next = [...checked];
    next[index] = !next[index];
    writeChecklist(next);
  }

  function handleReset() {
    if (typeof window !== "undefined" && !window.confirm(t.resetConfirm)) return;
    writeChecklist(emptyChecked());
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-gray-200 bg-[var(--muted-bg)] p-4">
        <p className="text-sm font-semibold text-black">{t.progress(doneCount)}</p>
        <div className="flex gap-2 no-print">
          <button type="button" onClick={handleReset} className="btn-outline">
            {t.reset}
          </button>
          <button type="button" onClick={() => window.print()} className="btn-outline">
            {t.print}
          </button>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-gray-200 border-t border-b border-gray-200">
        {items.map((label, i) => (
          <li key={label} className="flex items-start gap-3 py-3">
            <input
              type="checkbox"
              id={`checklist-item-${i}`}
              checked={checked[i]}
              onChange={() => toggle(i)}
              className="mt-1 h-4 w-4 flex-none accent-black"
            />
            <label htmlFor={`checklist-item-${i}`} className="text-sm text-gray-800">
              {label}
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-gray-500">{t.caption}</p>

      <div className="mt-6 no-print">
        <ShareButtons topicId={topicId} locale={locale} url={canonicalUrl} title={t.shareTitle} />
      </div>
    </div>
  );
}
