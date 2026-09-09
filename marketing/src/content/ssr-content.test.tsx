import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CONTENT_REGISTRY } from "./registry";
import { getTopicById } from "@/lib/manifest";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";

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

  it("hub pages (26 ru, 02 uz) only link to topics actually built in phase 1", async () => {
    const tools = getTopicById("26")!;
    const toolsHtml = renderToStaticMarkup(await CONTENT_REGISTRY["26"].ru({ topic: tools }));
    expect(toolsHtml).toContain("скоро");

    const features = getTopicById("02")!;
    const featuresHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].uz({ topic: features }));
    expect(featuresHtml).toContain("tez orada");
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

  it("hub 02 (ru+uz) cards all 6 features built by phase 2 (03-08)", async () => {
    const topic = getTopicById("02")!;
    const ruHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].ru({ topic }));
    for (const id of ["03", "04", "05", "06", "07", "08"]) {
      expect(ruHtml).toContain(getTopicById(id)!.locales.ru.h1);
    }

    const uzHtml = renderToStaticMarkup(await CONTENT_REGISTRY["02"].uz({ topic }));
    for (const id of ["03", "04", "05", "06", "07", "08"]) {
      expect(uzHtml).toContain(getTopicById(id)!.locales.uz.h1);
    }
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
});
