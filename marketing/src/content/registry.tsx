import type { ReactElement } from "react";
import type { Topic } from "@/lib/manifest";

import Body01Ru from "./ru/01-home";
import Body01Uz from "./uz/01-home";
import Body02Ru from "./ru/02-vozmozhnosti";
import Body02Uz from "./uz/02-imkoniyatlar";
import Body06Ru from "./ru/06-zakrytie-mesyaca";
import Body06Uz from "./uz/06-oyni-yopish";
import Body17Ru from "./ru/17-tarify";
import Body17Uz from "./uz/17-tariflar";
import Body21Ru from "./ru/21-chek-list-zakrytiya-mesyaca";
import Body21Uz from "./uz/21-oyni-yopish-tekshiruv-royxati";
import Body26Ru from "./ru/26-instrumenty";
import Body26Uz from "./uz/26-vositalar";
import Body27Ru from "./ru/27-kalkulyator-marzhi-i-nacenki";
import Body27Uz from "./uz/27-marja-va-ustama-kalkulyatori";

// Тело страницы (уникальный контент темы) может быть асинхронным серверным
// компонентом (например, тема 17 — цена запрашивается на сервере), поэтому
// тип допускает Promise<ReactElement> в возвращаемом значении. Ограничен
// функциональными компонентами (не ComponentType/классами) — это единственная
// форма, которую используют файлы src/content/{ru,uz}/*.tsx, и именно эта
// сигнатура нужна для прямого вызова в тестах (src/content/ssr-content.test.tsx).
type BodyComponent = (props: { topic: Topic }) => ReactElement | Promise<ReactElement>;

// Реестр «topicId → { ru, uz }». Добавление новой темы в фазе 2 = одна запись
// в src/content/seo-pages.ts + два файла контента + одна строка здесь.
export const CONTENT_REGISTRY: Record<string, Record<"ru" | "uz", BodyComponent>> = {
  "01": { ru: Body01Ru, uz: Body01Uz },
  "02": { ru: Body02Ru, uz: Body02Uz },
  "06": { ru: Body06Ru, uz: Body06Uz },
  "17": { ru: Body17Ru, uz: Body17Uz },
  "21": { ru: Body21Ru, uz: Body21Uz },
  "26": { ru: Body26Ru, uz: Body26Uz },
  "27": { ru: Body27Ru, uz: Body27Uz },
};
