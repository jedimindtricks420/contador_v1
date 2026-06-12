import { AccountType } from '@prisma/client'

/**
 * Детерминированная функция классификации типа счёта по его коду.
 * Источник правил: ТЗ Шаг 1, раздел 3 (account_types_mapping.csv — 340 счетов).
 *
 * ВАЖНО: функция не имеет дефолтного return.
 * Если код не подходит ни под одно правило — выбрасывается Error.
 * Это гарантирует, что миграция остановится, а не присвоит ACTIVE по умолчанию.
 */
export function classifyAccountType(code: string): AccountType {
  // 3-значные коды (001–016) → забалансовые
  if (/^\d{3}$/.test(code) && parseInt(code, 10) >= 1 && parseInt(code, 10) <= 16) {
    return AccountType.OFF_BALANCE
  }

  // Вспомогательный счёт ввода начальных остатков
  if (code === '0000') return AccountType.ACTIVE_PASSIVE

  // Износ ОС (02xx) и амортизация НМА (05xx) → контр-актив
  if (code.startsWith('02') || code.startsWith('05')) return AccountType.CONTRA_ACTIVE

  // Остальные 0xxx → актив (ОС, НМА, инвестиции, капвложения, долгосрочная дебиторка)
  if (code.startsWith('0')) return AccountType.ACTIVE

  // Торговая наценка (2980) и резервы по сомнительным долгам (49xx) → контр-актив
  if (code === '2980' || code.startsWith('49')) return AccountType.CONTRA_ACTIVE

  // 1xxx, 2xxx (кроме 2980), 3xxx, 4xxx (кроме 49xx), 5xxx → активы
  if (/^[1-5]/.test(code)) return AccountType.ACTIVE

  // Выкупленные собственные акции (86xx) → контр-пассив
  if (code.startsWith('86')) return AccountType.CONTRA_PASSIVE

  // 6xxx, 7xxx → пассив (обязательства)
  if (/^[67]/.test(code)) return AccountType.PASSIVE

  // 8xxx (кроме 86xx выше) → пассив (капитал)
  if (/^8/.test(code)) return AccountType.PASSIVE

  // 9xxx — счета доходов/расходов (не попадают в баланс):

  // Возвраты продаж (9040) и скидки (9050) → контр-доход
  if (code === '9040' || code === '9050') return AccountType.CONTRA_INCOME

  // Доходы от основной деятельности (90xx кроме 9040/9050), прочие доходы (93xx),
  // доходы от финансовой деятельности (95xx), чрезвычайные прибыли (9710)
  if (
    code.startsWith('90') ||
    code.startsWith('93') ||
    code.startsWith('95') ||
    code === '9710'
  ) return AccountType.INCOME

  // Себестоимость (91xx), выбытие активов (92xx), расходы периода (94xx),
  // расходы по финансовой деятельности (96xx), чрезвычайные убытки (9720),
  // налог на прибыль (98xx)
  if (
    code.startsWith('91') ||
    code.startsWith('92') ||
    code.startsWith('94') ||
    code.startsWith('96') ||
    code === '9720' ||
    code.startsWith('98')
  ) return AccountType.EXPENSE

  // Чрезвычайные прибыли/убытки (заголовок 9700), конечный финрезультат (9900, 9910)
  if (code === '9700' || code === '9900' || code === '9910') return AccountType.ACTIVE_PASSIVE

  // Если ни одно правило не сработало — остановить миграцию
  throw new Error(
    `[account-classifier] Не удалось классифицировать код счёта: "${code}". ` +
    `Добавьте правило в classifyAccountType() и повторите миграцию.`
  )
}

/**
 * Определяет, является ли счёт постируемым (можно ли на него делать проводки).
 * Групповые заголовки (4 цифры, оканчиваются на 00, кроме 0000) — не постируемые.
 */
export function isPostable(code: string): boolean {
  return !(code.length === 4 && code.endsWith('00') && code !== '0000')
}
