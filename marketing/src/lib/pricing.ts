// Годовая цена тарифа PRO — источник истины: внутренний admin-сервис
// (тот же эндпоинт, что уже использует v2, см. v2/src/app/api/payments/subscription/route.ts
// и admin/server.ts:276 `GET /admin/api/payment-info` -> { pro_price_yearly }).
// Цена НЕ зашита как статический текст: администратор может изменить её через
// admin-панель без пересборки маркетингового сайта, поэтому маркетинговое
// приложение обращается к тому же внутреннему сетевому адресу при каждой
// регенерации страницы тарифов (ISR revalidate, см. src/app/[locale]/[[...slug]]/page.tsx).
// Код fallback используется, только если admin-сервис недоступен из сети
// сервера — это отображаемая страница, а не платёжное действие, поэтому
// деградация без ошибки допустима (тот же принцип, что и в v2 route.ts).
export const FALLBACK_PRO_PRICE_YEARLY = 299_000;

const ADMIN_API_URL = process.env.ADMIN_API_URL || "http://localhost:3031";

export interface ProPriceResult {
  price: number;
  source: "admin-api" | "fallback";
}

export async function getProPriceYearly(): Promise<ProPriceResult> {
  try {
    const res = await fetch(`${ADMIN_API_URL}/admin/api/payment-info`, {
      // Цена меняется редко и не мгновенно критична для лендинга — раз в час
      // достаточно, чтобы не бить внутренний сервис на каждой сборке/визите.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { price: FALLBACK_PRO_PRICE_YEARLY, source: "fallback" };
    }
    const data = (await res.json()) as { pro_price_yearly?: unknown };
    const value = Number(data.pro_price_yearly);
    if (!Number.isFinite(value) || value <= 0) {
      return { price: FALLBACK_PRO_PRICE_YEARLY, source: "fallback" };
    }
    return { price: value, source: "admin-api" };
  } catch {
    return { price: FALLBACK_PRO_PRICE_YEARLY, source: "fallback" };
  }
}
