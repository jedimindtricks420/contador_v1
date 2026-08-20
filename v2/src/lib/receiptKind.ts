// Определение вида документа поступления по покупке: товары или услуги.
//
// Мастер закрытия исторически создавал для любого входящего ЭСФ «Поступление
// товаров» (Дт 2910 — склад). Для организаций, покупающих услуги (подписки,
// лицензии для собственного пользования, IT-сервисы), это неверно: услуга —
// расход периода (Дт 9420), а не запас. Источник истины — категория, которую
// пользователь выбрал для исходного платежа при классификации транзакций:
// «Оплата поставщику за услуги» → SERVICE_RECEIVED*, иначе консервативный
// дефолт «товары» (перепродажа/ТМЗ). Пользователь может переопределить выбор
// явно (receiptKind в API шага подтверждения ЭСФ).

export type ReceiptKind = "goods" | "services";

const SERVICE_PAYMENT_TYPE_CODES = new Set(["SUPPLIER_PAYMENT_SERVICES"]);

export function receiptKindFromPaymentType(paymentTypeCode: string | null | undefined): ReceiptKind {
  return paymentTypeCode && SERVICE_PAYMENT_TYPE_CODES.has(paymentTypeCode) ? "services" : "goods";
}

// prepaid=true — закрытие ранее уплаченного аванса (Кт 4310),
// prepaid=false — поступление в долг (Кт 6010).
export function receiptDocTypeCode(kind: ReceiptKind, prepaid: boolean): string {
  if (kind === "services") return prepaid ? "SERVICE_RECEIVED_PREPAID" : "SERVICE_RECEIVED";
  return prepaid ? "GOODS_RECEIVED_PREPAID" : "GOODS_RECEIVED";
}

// Аналог receiptDocTypeCode для стороны продажи (исходящий ЭСФ покупателю):
// kind="goods" ведёт выручку на 9020 (реализация товаров) вместо 9030 (услуги),
// что необходимо для матчинга со списанием себестоимости (GOODS_SOLD, Дт9120/Кт2910)
// — см. docs/backlog_profit_tax.md, кейс GP TECH UNION.
// prepaid=true — закрытие полученного аванса (Дт 6310),
// prepaid=false — реализация в долг (Дт 4010).
export function saleDocTypeCode(kind: ReceiptKind, prepaid: boolean): string {
  if (kind === "goods") return prepaid ? "INVOICE_CONFIRMED_PREPAID_GOODS" : "INVOICE_CONFIRMED_GOODS";
  return prepaid ? "INVOICE_CONFIRMED_PREPAID" : "INVOICE_CONFIRMED";
}
