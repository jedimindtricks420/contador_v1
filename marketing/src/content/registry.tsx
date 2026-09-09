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
import Body09Ru from "./ru/09-dvizhenie-denezhnyh-sredstv";
import Body09Uz from "./uz/09-pul-oqimi";
import Body10Ru from "./ru/10-oborotno-saldovaya-vedomost";
import Body10Uz from "./uz/10-aylanma-saldo-qaydnomasi";
import Body11Ru from "./ru/11-zhurnal-provodok";
import Body11Uz from "./uz/11-otkazmalar-jurnali";
import Body12Ru from "./ru/12-kartochka-scheta";
import Body12Uz from "./uz/12-hisobvaraq-kartochkasi";
import Body13Ru from "./ru/13-avansy-i-podotchet";
import Body13Uz from "./uz/13-avanslar-va-hisobdor-summalar";
import Body14Ru from "./ru/14-dlya-buhgalterov";
import Body14Uz from "./uz/14-buxgalterlar-uchun";
import Body15Ru from "./ru/15-dlya-rukovoditeley";
import Body15Uz from "./uz/15-rahbarlar-uchun";
import Body16Ru from "./ru/16-dlya-kompaniy-uslug";
import Body16Uz from "./uz/16-xizmat-korsatish-korxonalari-uchun";
import Body17Ru from "./ru/17-tarify";
import Body17Uz from "./uz/17-tariflar";
import Body18Ru from "./ru/18-rukovodstva";
import Body18Uz from "./uz/18-qollanmalar";
import Body19Ru from "./ru/19-podgotovka-bankovskoy-vypiski";
import Body19Uz from "./uz/19-bank-kochirmasini-tayyorlash";
import Body20Ru from "./ru/20-proverka-ai-klassifikacii";
import Body20Uz from "./uz/20-ai-tasnifini-tekshirish";
import Body21Ru from "./ru/21-chek-list-zakrytiya-mesyaca";
import Body21Uz from "./uz/21-oyni-yopish-tekshiruv-royxati";
import Body22Ru from "./ru/22-pribyl-i-denezhnyy-potok";
import Body22Uz from "./uz/22-foyda-va-pul-oqimi-farqi";
import Body23Ru from "./ru/23-kak-chitat-osv";
import Body23Uz from "./uz/23-aylanma-saldo-qaydnomasini-oqish";
import Body24Ru from "./ru/24-nachalnye-ostatki";
import Body24Uz from "./uz/24-boshlangich-qoldiqlar";
import Body25Ru from "./ru/25-kak-vybrat-buhgalterskuyu-programmu";
import Body25Uz from "./uz/25-buxgalteriya-dasturini-tanlash";
import Body26Ru from "./ru/26-instrumenty";
import Body26Uz from "./uz/26-vositalar";
import Body27Ru from "./ru/27-kalkulyator-marzhi-i-nacenki";
import Body27Uz from "./uz/27-marja-va-ustama-kalkulyatori";
import Body30Ru from "./ru/30-perehod-iz-excel";
import Body30Uz from "./uz/30-exceldan-otish";

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
  "09": { ru: Body09Ru, uz: Body09Uz },
  "10": { ru: Body10Ru, uz: Body10Uz },
  "11": { ru: Body11Ru, uz: Body11Uz },
  "12": { ru: Body12Ru, uz: Body12Uz },
  "13": { ru: Body13Ru, uz: Body13Uz },
  "14": { ru: Body14Ru, uz: Body14Uz },
  "15": { ru: Body15Ru, uz: Body15Uz },
  "16": { ru: Body16Ru, uz: Body16Uz },
  "17": { ru: Body17Ru, uz: Body17Uz },
  "18": { ru: Body18Ru, uz: Body18Uz },
  "19": { ru: Body19Ru, uz: Body19Uz },
  "20": { ru: Body20Ru, uz: Body20Uz },
  "21": { ru: Body21Ru, uz: Body21Uz },
  "22": { ru: Body22Ru, uz: Body22Uz },
  "23": { ru: Body23Ru, uz: Body23Uz },
  "24": { ru: Body24Ru, uz: Body24Uz },
  "25": { ru: Body25Ru, uz: Body25Uz },
  "26": { ru: Body26Ru, uz: Body26Uz },
  "27": { ru: Body27Ru, uz: Body27Uz },
  "30": { ru: Body30Ru, uz: Body30Uz },
};
