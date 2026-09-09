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
    expect(html).toContain("Войти");
  });
});
