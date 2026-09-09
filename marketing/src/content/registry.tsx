import type { ReactElement } from "react";
import type { Topic } from "@/lib/manifest";

import Body01Ru from "./ru/01-home";
import Body01Uz from "./uz/01-home";
import Body02Ru from "./ru/02-vozmozhnosti";
import Body02Uz from "./uz/02-imkoniyatlar";
import Body03Ru from "./ru/03-import-bankovskih-vypisok";
import Body03Uz from "./uz/03-bank-kochirmalarini-import-qilish";
import Body04Ru from "./ru/04-ai-klassifikaciya-operacij";
import Body04Uz from "./uz/04-ai-operatsiyalar-tasnifi";
import Body05Ru from "./ru/05-buhgalterskie-provodki";
import Body05Uz from "./uz/05-buxgalteriya-otkazmalari";
import Body06Ru from "./ru/06-zakrytie-mesyaca";
import Body06Uz from "./uz/06-oyni-yopish";
import Body07Ru from "./ru/07-buhgalterskiy-balans";
import Body07Uz from "./uz/07-buxgalteriya-balansi";
import Body08Ru from "./ru/08-otchet-o-pribylyah-i-ubytkah";
import Body08Uz from "./uz/08-foyda-va-zarar-hisoboti";
import Body14Ru from "./ru/14-dlya-buhgalterov";
import Body14Uz from "./uz/14-buxgalterlar-uchun";
import Body15Ru from "./ru/15-dlya-rukovoditeley";
import Body15Uz from "./uz/15-rahbarlar-uchun";
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

// Реестр «topicId → { ru, uz }». Добавление новой темы в следующей фазе = одна
// запись в src/content/seo-pages.ts + два файла контента + одна строка здесь.
export const CONTENT_REGISTRY: Record<string, Record<"ru" | "uz", BodyComponent>> = {
  "01": { ru: Body01Ru, uz: Body01Uz },
  "02": { ru: Body02Ru, uz: Body02Uz },
  "03": { ru: Body03Ru, uz: Body03Uz },
  "04": { ru: Body04Ru, uz: Body04Uz },
  "05": { ru: Body05Ru, uz: Body05Uz },
  "06": { ru: Body06Ru, uz: Body06Uz },
  "07": { ru: Body07Ru, uz: Body07Uz },
  "08": { ru: Body08Ru, uz: Body08Uz },
  "14": { ru: Body14Ru, uz: Body14Uz },
  "15": { ru: Body15Ru, uz: Body15Uz },
  "17": { ru: Body17Ru, uz: Body17Uz },
  "21": { ru: Body21Ru, uz: Body21Uz },
  "26": { ru: Body26Ru, uz: Body26Uz },
  "27": { ru: Body27Ru, uz: Body27Uz },
};
