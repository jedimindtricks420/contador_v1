import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CONTENT_REGISTRY } from "./registry";
import { getTopicById } from "@/lib/manifest";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";

// Wave 2 (TASK-0004): several new UZ manifest strings (title/h1/description,
// used verbatim from wave2-metadata.md) contain a plain ASCII apostrophe ('),
// unlike the rest of the UZ content in this project, which by convention uses
// a typographic curly apostrophe (’) specifically to avoid this exact issue —
// React's renderToStaticMarkup HTML-escapes a literal ' in text nodes to
// "&#x27;" (correct, harmless, renders as a normal apostrophe in every real
// browser), so a raw string-equality check against the un-escaped source
// string fails even though the real HTTP output is fine. This helper mirrors
// that escaping so SSR assertions check what actually lands in the HTML.
const apos = (s: string) => s.replace(/'/g, "&#x27;");

// Прямая проверка требования из отчёта задачи: H1/description/тело страницы
// должны присутствовать в исходном серверном HTML, а не только в клиентском
// рендере. В Next 16.2.1 конкретные пререндеренные .html для маршрутов на
// базе generateStaticParams не материализуются на диск во время `next build`
// в этом проекте (route зарегистрирован как dynamicRoute в routes-manifest.json,
// а не как staticRoute — проверено вручную после сборки), и `next start`
// запускать нельзя (правило хоста — не поднимать серверы для проверки).
// Поэтому здесь напрямую вызываются те же самые серверные компоненты, что
// использует src/app/[locale]/[[...slug]]/page.tsx (CONTENT_REGISTRY,
// Header, Footer), и результат прогоняется через react-dom/server —
// без роутинга Next.js и без единого запущенного процесса-сервера.
describe("SSR output contains real content, not client-only", () => {
  it("home (ru) renders H1, flow steps and FAQ text server-side", async () => {
    const topic = getTopicById("01")!;
    const Body = CONTENT_REGISTRY["01"].ru;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    // topic.locales.ru.description — это meta-description (рендерится через
    // generateMetadata в <head>, не в теле страницы), поэтому здесь проверяем
    // H1, реальный текст блоков и FAQ, а не строку meta description.
    expect(html).toContain(topic.locales.ru.h1);
    expect(html).toContain("Импорт");
    expect(html).toContain(topic.locales.ru.faq[0].q);
  });

  it("home (uz) renders H1 and body text in Uzbek, not a Russian fallback", async () => {
    const topic = getTopicById("01")!;
    const Body = CONTENT_REGISTRY["01"].uz;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.uz.h1);
    expect(html).toContain("Ko‘chirmadan hisobotgacha");
  });

  it("closing wizard (ru) renders all 7 real step titles server-side", async () => {
    const topic = getTopicById("06")!;
    const Body = CONTENT_REGISTRY["06"].ru;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    for (const step of [
      "Импорт выписки",
      "Уточнение категорий",
      "Проверка реестра",
      "Начисления периода",
      "Курсовые разницы",
      "Сверка с Soliq",
      "Финализация",
    ]) {
      expect(html).toContain(step);
    }
  });

  it("pricing (ru) renders the resolved price server-side (fallback path — admin API unreachable in tests)", async () => {
    const topic = getTopicById("17")!;
    const Body = CONTENT_REGISTRY["17"].ru;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.ru.h1);
    expect(html).toContain("299");
    expect(html).toContain("FREE");
    expect(html).toContain("PRO");
  });

  it("checklist (uz) renders all 10 items and the disclaimer caption server-side", async () => {
    const topic = getTopicById("21")!;
    const Body = CONTENT_REGISTRY["21"].uz;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.uz.h1);
    expect(html).toContain("Kerakli hisobvaraqlar ko‘chirmalari yig‘ilgan");
    expect(html).toContain("Ishchi tekshiruv ro‘yxati");
  });

  it("margin calculator tool (ru) renders labels and the worked example server-side", async () => {
    const topic = getTopicById("27")!;
    const Body = CONTENT_REGISTRY["27"].ru;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Себестоимость");
    expect(html).toContain("125 000");
    expect(html).toContain("маржа 20%, наценка 25%");
  });

  it("tools hub (26, ru+uz) cards all 3 built calculators server-side (phase 5: no more 'скоро'/'tez orada' placeholders)", async () => {
    const tools = getTopicById("26")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["26"].ru({ topic: tools }));
    for (const id of ["27", "28", "29"]) {
      expect(ruHtml).toContain(getTopicById(id)!.locales.ru.h1);
    }
    expect(ruHtml).not.toContain("скоро");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["26"].uz({ topic: tools }));
    for (const id of ["27", "28", "29"]) {
      expect(uzHtml).toContain(getTopicById(id)!.locales.uz.h1);
    }
    expect(uzHtml).not.toContain("tez orada");
  });

  // Фаза 2 (TASK-0003): 7 новых тем — 03, 04, 05, 07, 08, 14, 15. Та же техника:
  // прямой вызов серверных компонентов из CONTENT_REGISTRY + renderToStaticMarkup,
  // без роутинга Next.js и без запущенного сервера (см. пояснение вверху файла).
  it("bank import (03, ru+uz) renders H1 and real supported formats server-side", async () => {
    const topic = getTopicById("03")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["03"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain(".txt");
    expect(ruHtml).toContain(".xlsx");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["03"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
    expect(uzHtml).toContain("1CClientBankExchange");
  });

  it("AI classification (04, ru+uz) renders H1 and the confirmed-vs-suggested distinction server-side", async () => {
    const topic = getTopicById("04")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["04"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Предложено AI");
    expect(ruHtml).toContain("Подтверждено");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["04"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("postings (05, ru+uz) renders H1 and real document statuses server-side", async () => {
    const topic = getTopicById("05")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["05"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Проведён");
    expect(ruHtml).toContain("Аннулирован");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["05"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("balance (07, ru+uz) renders H1 and the demo balance example server-side", async () => {
    const topic = getTopicById("07")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["07"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Уставный капитал");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["07"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("P&L (08, ru+uz) renders H1 and the profit-vs-cash distinction server-side", async () => {
    const topic = getTopicById("08")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["08"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Финансовый результат за период");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["08"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("for accountants (14, ru+uz) renders H1 and links to real feature topics server-side", async () => {
    const topic = getTopicById("14")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["14"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain(getTopicById("06")!.locales.ru.h1);

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["14"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("for executives (15, ru+uz) renders H1 and the profit-vs-cash question server-side", async () => {
    const topic = getTopicById("15")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["15"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Сколько прибыли заработал бизнес за месяц?");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["15"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("hub 02 (ru+uz) cards the full built group 03-13 (phase 3: no more 'скоро' placeholders)", async () => {
    const topic = getTopicById("02")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].ru({ topic }));
    for (const id of ["03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"]) {
      expect(ruHtml).toContain(getTopicById(id)!.locales.ru.h1);
    }
    expect(ruHtml).not.toContain("скоро");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].uz({ topic }));
    for (const id of ["03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"]) {
      expect(uzHtml).toContain(getTopicById(id)!.locales.uz.h1);
    }
    expect(uzHtml).not.toContain("tez orada");
  });

  // Фаза 3 (TASK-0003): 6 новых тем — 09, 10, 11, 12, 13, 16. Та же техника:
  // прямой вызов серверных компонентов из CONTENT_REGISTRY + renderToStaticMarkup,
  // без роутинга Next.js и без запущенного сервера (см. пояснение вверху файла).
  it("cash flow (09, ru+uz) renders H1 and the real demo inflow/outflow figures server-side", async () => {
    const topic = getTopicById("09")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["09"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Оплата от покупателей");
    expect(ruHtml).toContain("прогнозирования будущих поступлений и выплат в сервисе нет");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["09"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("OSV (10, ru+uz) renders H1 and the demo turnover table server-side", async () => {
    const topic = getTopicById("10")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["10"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Денежные средства на счетах");
    expect(ruHtml).toContain("Начало");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["10"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("posting journal (11, ru+uz) renders H1, 3 demo entries and the not-a-legal-audit disclaimer server-side", async () => {
    const topic = getTopicById("11")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["11"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Банковское поступление");
    expect(ruHtml).toContain("Банковское списание");
    expect(ruHtml).toContain("Авансовый отчёт");
    expect(ruHtml).toContain("неизменяемый");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["11"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("account card (12, ru+uz) renders H1 and distinguishes ledger account from bank account server-side", async () => {
    const topic = getTopicById("12")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["12"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("не о конкретном банковском расчётном счёте");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["12"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("open positions (13, ru+uz) renders H1, the advance example and no auto-reminder claim server-side", async () => {
    const topic = getTopicById("13")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["13"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("800 000");
    expect(ruHtml).toContain("Автоматических напоминаний");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["13"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("for services companies (16, ru+uz) renders H1 and links to real feature topics server-side", async () => {
    const topic = getTopicById("16")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["16"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain(getTopicById("13")!.locales.ru.h1);
    expect(ruHtml).toContain(getTopicById("08")!.locales.ru.h1);
    expect(ruHtml).toContain(getTopicById("06")!.locales.ru.h1);

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["16"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("postings (05, ru+uz) now links to the real posting journal (11) instead of 'coming soon' text", async () => {
    const topic = getTopicById("05")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["05"].ru({ topic }));
    expect(ruHtml).toContain(getTopicById("11")!.locales.ru.h1);
    expect(ruHtml).not.toContain("в разработке");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["05"].uz({ topic }));
    expect(uzHtml).toContain(getTopicById("11")!.locales.uz.h1);
    expect(uzHtml).not.toContain("ishlab chiqilmoqda");
  });

  it("Header (ru) keeps the spec's frozen 7-item menu and does NOT add topic 16", () => {
    // §6 "Меню RU/UZ" fixes the menu literally; 16 isn't in that list (unlike
    // 14/15, which are). Reviewed 2026-09-09: 16 stays reachable via
    // relatedIds from 06/08/13 and the sitemap instead of a nav entry.
    const home = getTopicById("01")!;
    const html = renderToStaticMarkup(<Header topic={home} locale="ru" />);
    expect(html).not.toContain("Для компаний услуг");
  });

  it("Header and Footer render real nav labels and CTA text server-side", () => {
    const home = getTopicById("01")!;
    const html = renderToStaticMarkup(
      <>
        <Header topic={home} locale="ru" />
        <Footer locale="ru" />
      </>,
    );
    expect(html).toContain("Тарифы");
    expect(html).toContain("Инструменты");
    expect(html).toContain("Для бухгалтеров");
    expect(html).toContain("Для руководителей");
    expect(html).toContain("Войти");
  });

  // Фаза 4 (TASK-0003): +8 тем — хаб 18 и все 7 руководств (19, 20, 22, 23,
  // 24, 25, 30). Та же техника: прямой вызов серверных компонентов из
  // CONTENT_REGISTRY + renderToStaticMarkup (см. пояснение вверху файла).
  it("Header (ru+uz) now includes 'Руководства'/'Qo‘llanmalar' — 18 IS in the spec's frozen 7-item menu, unlike topic 16", () => {
    const home = getTopicById("01")!;
    const ruHtml = renderToStaticMarkup(<Header topic={home} locale="ru" />);
    expect(ruHtml).toContain("Руководства");

    const uzHtml = renderToStaticMarkup(<Header topic={home} locale="uz" />);
    expect(uzHtml).toContain("Qo‘llanmalar");
  });

  it("guides hub (18, ru+uz) cards all 7 built guides across its 3 groups server-side", async () => {
    const topic = getTopicById("18")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["18"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    for (const id of ["19", "20", "21", "22", "23", "24", "25", "30"]) {
      expect(ruHtml).toContain(getTopicById(id)!.locales.ru.h1);
    }

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["18"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
    for (const id of ["19", "20", "21", "22", "23", "24", "25", "30"]) {
      expect(uzHtml).toContain(getTopicById(id)!.locales.uz.h1);
    }
  });

  it("prepare bank statement guide (19, ru+uz) renders H1, the real supported formats and the mistakes table server-side", async () => {
    const topic = getTopicById("19")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["19"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain(".txt");
    expect(ruHtml).toContain(".xlsx");
    expect(ruHtml).toContain("откат импорта");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["19"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("checking AI classification guide (20, ru+uz) renders H1 and the 3 fictional examples, no chat-UI or invented confidence number", async () => {
    const topic = getTopicById("20")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["20"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Перевод между своими счетами");
    expect(ruHtml).toContain("Аванс поставщику");
    expect(ruHtml).toContain("не диалоговый чат-интерфейс");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["20"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("profit vs cash flow guide (22, ru+uz) renders H1 and the deferred-payment example server-side", async () => {
    const topic = getTopicById("22")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["22"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("10 000 000 сум");
    expect(ruHtml).toContain("не учитывает налоги");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["22"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("reading OSV guide (23, ru+uz) renders H1 and the annotated own-data example server-side", async () => {
    const topic = getTopicById("23")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["23"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Расчёты с покупателями");
    expect(ruHtml).toContain("8 700 000");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["23"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("opening balances guide (24, ru+uz) renders H1, the real settings route reference and no full-1C-migration promise", async () => {
    const topic = getTopicById("24")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["24"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("не переносит базу 1С");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["24"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("choosing a program guide (25, ru+uz) renders H1 and an empty self-scoring column, not a fabricated ranking", async () => {
    const topic = getTopicById("25")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["25"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Ваша оценка");
    // Explicit disclaimer text, not a fabricated ranking/scoreboard: no named
    // competitors and no numbered "1 место"/"2 место" placement anywhere.
    expect(ruHtml).toContain("не содержит сравнения с конкретными конкурентами");
    expect(ruHtml).not.toMatch(/\d\s*место/);

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["25"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("transition from Excel guide (30, ru+uz) renders H1 and the transfer-scope table, no one-click conversion promise", async () => {
    const topic = getTopicById("30")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["30"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("не автоматическая конвертация");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["30"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("pair cross-links (03↔19, 04↔20, 08↔22, 10↔23) render on both sides server-side", async () => {
    const t03 = getTopicById("03")!;
    const t19 = getTopicById("19")!;
    const t04 = getTopicById("04")!;
    const t20 = getTopicById("20")!;
    const t08 = getTopicById("08")!;
    const t22 = getTopicById("22")!;
    const t10 = getTopicById("10")!;
    const t23 = getTopicById("23")!;

    const html03 = renderToStaticMarkup(await CONTENT_REGISTRY["03"].ru({ topic: t03 }));
    expect(html03).toContain(t19.locales.ru.h1);
    const html19 = renderToStaticMarkup(await CONTENT_REGISTRY["19"].ru({ topic: t19 }));
    expect(html19).toContain(t03.locales.ru.h1);

    const html04 = renderToStaticMarkup(await CONTENT_REGISTRY["04"].ru({ topic: t04 }));
    expect(html04).toContain(t20.locales.ru.h1);
    const html20 = renderToStaticMarkup(await CONTENT_REGISTRY["20"].ru({ topic: t20 }));
    expect(html20).toContain(t04.locales.ru.h1);

    const html08 = renderToStaticMarkup(await CONTENT_REGISTRY["08"].ru({ topic: t08 }));
    expect(html08).toContain(t22.locales.ru.h1);
    const html22 = renderToStaticMarkup(await CONTENT_REGISTRY["22"].ru({ topic: t22 }));
    expect(html22).toContain(t08.locales.ru.h1);

    const html10 = renderToStaticMarkup(await CONTENT_REGISTRY["10"].ru({ topic: t10 }));
    expect(html10).toContain(t23.locales.ru.h1);
    const html23 = renderToStaticMarkup(await CONTENT_REGISTRY["23"].ru({ topic: t23 }));
    expect(html23).toContain(t10.locales.ru.h1);
  });

  // Фаза 5 (TASK-0003, финальная): +2 темы — калькуляторы безубыточности (28)
  // и запаса денежных средств (29). Завершает полную матрицу 30 тем / 60 URL.
  // Та же техника: прямой вызов серверных компонентов из CONTENT_REGISTRY +
  // renderToStaticMarkup (см. пояснение вверху файла).
  it("breakeven calculator tool (28, ru) renders labels and both worked examples server-side", async () => {
    const topic = getTopicById("28")!;
    const Body = CONTENT_REGISTRY["28"].ru;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.ru.h1);
    expect(html).toContain("Постоянные расходы");
    expect(html).toContain("20 единиц, выручка 3 000 000");
    expect(html).toContain("20,5 единицы, округлённо 21 единица");
  });

  it("breakeven calculator tool (28, uz) renders H1 and body text in Uzbek server-side", async () => {
    const topic = getTopicById("28")!;
    const Body = CONTENT_REGISTRY["28"].uz;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.uz.h1);
    expect(html).toContain("Doimiy xarajatlar");
  });

  it("cash runway calculator tool (29, ru) renders labels and the worked example server-side", async () => {
    const topic = getTopicById("29")!;
    const Body = CONTENT_REGISTRY["29"].ru;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.ru.h1);
    expect(html).toContain("Доступные деньги");
    expect(html).toContain("чистый отток 5 000 000, запас 6 месяцев");
    expect(html).toContain("не персональная инвестиционная рекомендация");
  });

  it("cash runway calculator tool (29, uz) renders H1 and body text in Uzbek server-side", async () => {
    const topic = getTopicById("29")!;
    const Body = CONTENT_REGISTRY["29"].uz;
    const element = await Body({ topic });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(topic.locales.uz.h1);
    expect(html).toContain("Mavjud pul");
  });

  it("margin calculator (27, ru+uz) now links to the breakeven calculator (28) via relatedIds", async () => {
    const t27 = getTopicById("27")!;
    const t28 = getTopicById("28")!;
    const html27 = renderToStaticMarkup(await CONTENT_REGISTRY["27"].ru({ topic: t27 }));
    expect(html27).toContain(t28.locales.ru.h1);
  });

  // Wave 2 (TASK-0004): +7 тем — 31 (налоговый календарь), 32 (калькулятор
  // налога с оборота), 33 (квартальный расчёт налога на прибыль), 34
  // (аудитория: продавцы маркетплейсов), 35 (сверка с Soliq и ЭСФ), 36 (гайд:
  // оборотный налог или НДС), 37 (гайд: штрафы за просрочку отчётности). Та же
  // техника: прямой вызов серверных компонентов из CONTENT_REGISTRY +
  // renderToStaticMarkup (см. пояснение вверху файла).
  it("tax calendar (31, ru+uz) renders H1, real event types and the not-an-official-calendar disclaimer server-side", async () => {
    const topic = getTopicById("31")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["31"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Налог с оборота");
    expect(ruHtml).toContain("Статистическая отчётность");
    expect(ruHtml).toContain("не официальный государственный календарь");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["31"].uz({ topic }));
    expect(uzHtml).toContain(apos(topic.locales.uz.h1));
    expect(uzHtml).toContain("Aylanma solig’i");
    expect(uzHtml).toContain("rasmiy davlat taqvimi emas");
  });

  it("turnover tax calculator (32, ru+uz) renders labels, the worked example and the mandatory disclaimer server-side", async () => {
    const topic = getTopicById("32")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["32"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Оборот за период");
    expect(ruHtml).toContain("2 000 000 сум");
    expect(ruHtml).toContain("не официальная декларация, не учитывает льготы и вычеты");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["32"].uz({ topic }));
    expect(uzHtml).toContain(apos(topic.locales.uz.h1));
    expect(uzHtml).toContain("rasmiy deklaratsiya emas");
  });

  it("quarterly profit tax (33, ru+uz) renders H1 and the real form line labels/quarters server-side", async () => {
    const topic = getTopicById("33")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["33"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Совокупный доход");
    expect(ruHtml).toContain("Вычитаемые расходы");
    expect(ruHtml).toContain("Налоговая база");
    expect(ruHtml).toContain("предварительно, до подтверждения");
    expect(ruHtml).toContain("II квартал (полугодие)");
    expect(ruHtml).toContain("сервис её не отправляет");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["33"].uz({ topic }));
    expect(uzHtml).toContain(apos(topic.locales.uz.h1));
    expect(uzHtml).toContain("III chorak (9 oy)");
  });

  it("marketplace sellers (34, ru+uz) renders H1, the fictional demo example and no invented commission percentage server-side", async () => {
    const topic = getTopicById("34")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["34"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Гулбахор Трейд");
    expect(ruHtml).toContain("не публикует и не подтверждает");
    expect(ruHtml).not.toMatch(/\d+\s?%\s*комисси/i);

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["34"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
  });

  it("Soliq/ESF reconciliation (35, ru+uz) renders H1, the real closing-wizard step reference and no auto-submit claim server-side", async () => {
    const topic = getTopicById("35")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["35"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Сверка с порталом my.soliq.uz");
    expect(ruHtml).toContain("не отправляет и не принимает");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["35"].uz({ topic }));
    expect(uzHtml).toContain(apos(topic.locales.uz.h1));
  });

  it("turnover tax vs VAT guide (36, ru+uz) renders H1 and the statutory 1 billion sum threshold from Article 461 server-side", async () => {
    const topic = getTopicById("36")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["36"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("один миллиард сумов");
    expect(ruHtml).toContain("статья 461");
    expect(ruHtml).toContain("не юридическая");

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["36"].uz({ topic }));
    expect(uzHtml).toContain(apos(topic.locales.uz.h1));
    expect(uzHtml).toContain("bir milliard so’m");
  });

  it("late-filing penalty guide (37, ru+uz) cites Article 220 but names NO specific fine amount/percentage — highest legal-risk page in this wave", async () => {
    const topic = getTopicById("37")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["37"].ru({ topic }));
    expect(ruHtml).toContain(topic.locales.ru.h1);
    expect(ruHtml).toContain("Статья 220");
    expect(ruHtml).toContain("административной ответственности");
    expect(ruHtml).toContain("не указываем здесь конкретную сумму");
    // No digit-percent pattern anywhere near "штраф"/"пен" — guards against a
    // future edit accidentally introducing an unconfirmed fine number.
    expect(ruHtml).not.toMatch(/\d+([.,]\d+)?\s?%/);

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["37"].uz({ topic }));
    expect(uzHtml).toContain(topic.locales.uz.h1);
    expect(uzHtml).toContain("220-moddasi");
    expect(uzHtml).not.toMatch(/\d+([.,]\d+)?\s?%/);
  });

  it("hub 02 (ru+uz) now cards the new tax feature group (31, 33, 35)", async () => {
    const topic = getTopicById("02")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].ru({ topic }));
    for (const id of ["31", "33", "35"]) {
      expect(ruHtml).toContain(getTopicById(id)!.locales.ru.h1);
    }
    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].uz({ topic }));
    for (const id of ["31", "33", "35"]) {
      expect(uzHtml).toContain(apos(getTopicById(id)!.locales.uz.h1));
    }
  });

  it("hub 18 (ru+uz) now cards the new tax guides (36, 37)", async () => {
    const topic = getTopicById("18")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["18"].ru({ topic }));
    for (const id of ["36", "37"]) {
      expect(ruHtml).toContain(getTopicById(id)!.locales.ru.h1);
    }
    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["18"].uz({ topic }));
    for (const id of ["36", "37"]) {
      expect(uzHtml).toContain(getTopicById(id)!.locales.uz.h1);
    }
  });

  it("hub 26 (ru+uz) now cards the new turnover tax calculator (32)", async () => {
    const topic = getTopicById("26")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["26"].ru({ topic }));
    expect(ruHtml).toContain(getTopicById("32")!.locales.ru.h1);
    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["26"].uz({ topic }));
    expect(uzHtml).toContain(apos(getTopicById("32")!.locales.uz.h1));
  });

  it("marketplace sellers (34) is reachable via an inbound relatedIds link from topic 06 (no orphan audience page)", async () => {
    const t06 = getTopicById("06")!;
    const t34 = getTopicById("34")!;
    const html06 = renderToStaticMarkup(await CONTENT_REGISTRY["06"].ru({ topic: t06 }));
    expect(html06).toContain(t34.locales.ru.h1);
  });
});
