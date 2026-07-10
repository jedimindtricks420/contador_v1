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
