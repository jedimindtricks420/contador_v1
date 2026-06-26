ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Исправление бухгалтерского движка Contador
Нормативная база: /home/admin1/contador/docs/contador_accounting_engine_spec.md

Директория: /home/admin1/contador/v2/src/

ЧАСТЬ 1 — BACKEND
B-1. closing.ts — Добавить проводку налога с оборота Дт 9810 → Кт 6410
Файл: lib/closing.ts

Строки: 252–345 (раздел E — расчёт налогов)

Спецификация: §5.2

Проблема: Для режима TURNOVER_TAX налог создаётся только в taxCalendarEvent, но никакая проводка в журнал не делается. Следствие: счёт 9810 пустой → при реформации баланса 9910 закрывается на полную сумму прибыли без вычета налога с оборота → счёт 8710 (нераспределённая прибыль) завышен → Форма №2 строка 270 и Форма №1 строка 450 содержат неверные данные.

Требуемые проводки по спецификации:


Начислен налог с оборота:
  Дт 9810  →  Кт 6410
Что делать:

В ensureBaseData.ts добавить тип документа TURNOVER_TAX_ACCRUAL:

{
  code: "TURNOVER_TAX_ACCRUAL",
  name: "Начисление налога с оборота",
  mode: "MANUAL_ONLY",
  template: {
    lines: [
      { accountCode: "9810", side: "debit", expression: "taxAmount" },
      { accountCode: "6410", side: "credit", expression: "taxAmount" }
    ],
    opensItem: false,
    requiresCounterparty: false
  }
}
В closing.ts, в блоке else (строки 515-560) после расчёта turnoverTaxAmt добавить создание проводки — зеркально тому, как PROFIT_TAX_ACCRUAL создаётся для VAT-режима (строки 312-344):

// После вычисления turnoverTaxAmt:
const existingTtax = await tx.document.findFirst({
  where: { orgId, periodId, type: { code: "TURNOVER_TAX_ACCRUAL" }, status: "POSTED" }
});
if (!existingTtax && turnoverTaxAmt.gt(0)) {
  const ttaxType = await tx.documentType.findFirst({ where: { code: "TURNOVER_TAX_ACCRUAL" } });
  if (ttaxType) {
    const ttaxDoc = await tx.document.create({
      data: {
        orgId, periodId, typeId: ttaxType.id, date: accrualDate, status: "POSTED",
        payload: { taxAmount: turnoverTaxAmt.toNumber() } as any
      }
    });
    await postDocument(ttaxDoc.id, tx, userId);
  }
}
Добавить в taxes[] пуш для налога с оборота (аналогично PROFIT_TAX):

taxes.push({ type: "TURNOVER_TAX", amount: turnoverTaxAmt, dueDate: nextMonth20th });
После добавления проводки — удалить дублирующий upsertTaxCalendarEventsForPeriod для создания TURNOVER_TAX события, поскольку taxes уже обрабатывает это через цикл в блоке F. Или оставить upsert только для обновления суммы, не создания события (уже создано через taxes).
B-2. api/pnl/route.ts — Переделать ответ под официальные строки Формы №2
Файл: app/api/pnl/route.ts

Спецификация: §3.1, §3.2

Проблема: API возвращает кастомные категории (salary, rent, advertising). Структура не соответствует официальным строкам 010-270 НСБУ. Нет строк 030 (валовая прибыль), 100 (прибыль от основной деятельности), 110-170 (финансовые доходы/расходы), 220, 230, 240, 260.

Что делать:

Изменить запрос журнальных проводок — вместо категорий по типу документа, агрегировать по коду счёта за период. Возвращать структуру с официальными строками.

Новая функция агрегации (заменяет текущий цикл for (const entry of entries)):


// Группировка по счёту: turnoverDebit / turnoverCredit за период
const aggByCode = new Map<string, { debit: Decimal; credit: Decimal }>();
for (const entry of entries) {
  const code = entry.account.code;
  const prev = aggByCode.get(code) ?? { debit: new Decimal(0), credit: new Decimal(0) };
  prev.debit = prev.debit.plus(new Decimal(entry.debit.toString()));
  prev.credit = prev.credit.plus(new Decimal(entry.credit.toString()));
  aggByCode.set(code, prev);
}
const td = (code: string) => aggByCode.get(code)?.debit ?? new Decimal(0);
const tc = (code: string) => aggByCode.get(code)?.credit ?? new Decimal(0);
const tcMany = (...codes: string[]) => codes.reduce((s, c) => s.plus(tc(c)), new Decimal(0));
const tdMany = (...codes: string[]) => codes.reduce((s, c) => s.plus(td(c)), new Decimal(0));
Убрать разделение по месяцам из основного расчёта (или повторить для каждого месяца). Добавить вычисление строк:


// стр. 010 Чистая выручка = Кт(9010+9020+9030) − Дт(9040+9050)
const line010 = tcMany("9010","9020","9030").minus(tdMany("9040","9050"));

// стр. 020 Себестоимость = Дт(9110+9120+9130)
const line020 = tdMany("9110","9120","9130");

// стр. 030 Валовая прибыль = 010 − 020
const line030 = line010.minus(line020);

// стр. 050 Расходы по реализации = Дт(9410)
const line050 = td("9410");
// стр. 060 Административные расходы = Дт(9420)
const line060 = td("9420");
// стр. 070 Прочие операционные расходы = Дт(9430)
const line070 = td("9430");
// стр. 080 Расходы, вычитаемые в будущем = Дт(9440)
const line080 = td("9440");
// стр. 040 Расходы периода = 050+060+070+080
const line040 = line050.plus(line060).plus(line070).plus(line080);

// стр. 090 Прочие доходы от осн. деят. = Кт(9310..9390)
const line090 = tcMany("9310","9320","9330","9340","9350","9360","9370","9380","9390");

// стр. 100 Прибыль от основной деятельности = 030 − 040 + 090
const line100 = line030.minus(line040).plus(line090);

// стр. 120-160 Доходы от финансовой деятельности
const line120 = tc("9520"); // дивиденды
const line130 = tc("9530"); // проценты
const line140 = tc("9550"); // финансовая аренда
const line150 = tc("9540"); // курсовые разницы (+)
const line160 = tcMany("9510","9560","9590"); // прочие
const line110 = line120.plus(line130).plus(line140).plus(line150).plus(line160);

// стр. 180-210 Расходы по финансовой деятельности
const line180 = td("9610"); // проценты
const line190 = new Decimal(0); // аналитика 9610 — в текущей системе не используется
const line200 = td("9620"); // убытки курсовые
const line210 = tdMany("9630","9690"); // прочие
const line170 = line180.plus(line190).plus(line200).plus(line210);

// стр. 220 Прибыль от общехозяйственной деятельности
const line220 = line100.plus(line110).minus(line170);

// стр. 230 Чрезвычайные прибыли и убытки
const line230 = tc("9710").minus(td("9720"));

// стр. 240 Прибыль до уплаты налога
const line240 = line220.plus(line230);

// стр. 250 Налог на прибыль или налог с оборота = Дт(9810)
const line250 = td("9810");
// Если 9810 = 0 (налог с оборота ещё не проведён) → использовать taxCalendarEvent как запасной вариант
const line250final = line250.gt(0) ? line250 : taxAmountFromCalendar;

// стр. 260 Прочие налоги от прибыли = Дт(9820)
const line260 = td("9820");

// стр. 270 Чистая прибыль = 240 − 250 − 260
const line270 = line240.minus(line250final).minus(line260);
Формат ответа — заменить текущий ответ на:


return NextResponse.json({
  period: { from: startDate, to: endDate },
  taxRegime: org?.taxRegime ?? "TURNOVER_TAX",
  lines: {
    line010: line010.toNumber(),   // Чистая выручка от реализации
    line020: line020.toNumber(),   // Себестоимость
    line030: line030.toNumber(),   // Валовая прибыль (убыток)
    line040: line040.toNumber(),   // Расходы периода
    line050: line050.toNumber(),
    line060: line060.toNumber(),
    line070: line070.toNumber(),
    line080: line080.toNumber(),
    line090: line090.toNumber(),   // Прочие доходы от осн. деятельности
    line100: line100.toNumber(),   // Прибыль от основной деятельности
    line110: line110.toNumber(),   // Доходы от финансовой деятельности
    line120: line120.toNumber(),
    line130: line130.toNumber(),
    line140: line140.toNumber(),
    line150: line150.toNumber(),
    line160: line160.toNumber(),
    line170: line170.toNumber(),   // Расходы по финансовой деятельности
    line180: line180.toNumber(),
    line200: line200.toNumber(),
    line210: line210.toNumber(),
    line220: line220.toNumber(),   // Прибыль от общехозяйственной деятельности
    line230: line230.toNumber(),   // Чрезвычайные
    line240: line240.toNumber(),   // Прибыль до уплаты налога
    line250: line250final.toNumber(),  // Налог на прибыль / налог с оборота
    line260: line260.toNumber(),
    line270: line270.toNumber(),   // Чистая прибыль
  },
  // Сохранить помесячный разрез для графиков — вычислить по той же логике, но per-month
  months,
  monthlyRevenue: [...],  // line010 по месяцам
  monthlyNetProfit: [...] // line270 по месяцам
});
Примечание: Сохранить помесячный разрез только для итоговых строк (010, 030, 100, 270) — для графиков на дашборде.

B-3. api/reports/balance/route.ts — Переделать ответ под строки Формы №1
Файл: app/api/reports/balance/route.ts

Спецификация: §2.2-2.5, §10

Проблема: API возвращает аккаунты сгруппированные по регекспам кода. Нет официальных строк 010-780, нет расчёта остаточной стоимости ОС/НМА, нет проверки 400=780.

Что делать:

Заменить текущую логику группировки на вычисление строк по формулам спецификации. Функция balance(code) возвращает чистое сальдо счёта по его типу из уже имеющегося cumulMap.


// Вспомогательная: дебетовое сальдо счётов-ASSET (или сумма группы)
function balDebit(...codes: string[]): Decimal {
  return codes.reduce((s, c) => {
    const row = cumulByCode.get(c);
    if (!row) return s;
    return s.plus(new Decimal(row.sumDebit).minus(new Decimal(row.sumCredit)).gt(0)
      ? new Decimal(row.sumDebit).minus(new Decimal(row.sumCredit))
      : new Decimal(0));
  }, new Decimal(0));
}

// Вспомогательная: кредитовое сальдо счётов-LIABILITY/CONTRA_ASSET
function balCredit(...codes: string[]): Decimal {
  return codes.reduce((s, c) => {
    const row = cumulByCode.get(c);
    if (!row) return s;
    return s.plus(new Decimal(row.sumCredit).minus(new Decimal(row.sumDebit)).gt(0)
      ? new Decimal(row.sumCredit).minus(new Decimal(row.sumDebit))
      : new Decimal(0));
  }, new Decimal(0));
}
Строить cumulByCode как Map<accountCode, row> (сейчас это cumulMap по accountId — нужно добавить маппинг по коду).

Вычислять строки по формулам из §10 спецификации дословно:


// АКТИВ — Раздел I
const line010 = balDebit("0100","0310");       // ОС: перв. стоимость (0100 + ОС по аренде 0310)
const line011 = balCredit("0200");             // Износ (контр-актив, кредит)
const line012 = line010.minus(line011);        // Остаточная стоимость ОС

const line020 = balDebit("0410","0420","0430","0440","0460","0470","0480","0490"); // НМА
const line021 = balCredit("0510","0520","0530","0540","0560","0570","0590");       // Амортизация НМА
const line022 = line020.minus(line021);

const line040 = balDebit("0610");
const line050 = balDebit("0620");
const line060 = balDebit("0630");
const line070 = balDebit("0640");
const line080 = balDebit("0690");
const line030 = line040.plus(line050).plus(line060).plus(line070).plus(line080);

const line090 = balDebit("0710","0720");       // Оборудование к установке
const line100 = balDebit("0810","0820","0830","0840","0850","0860","0870","0890"); // Кап. вложения
const line110 = balDebit("0910","0920","0930","0940"); // Долгосрочная дебиторка
const line120 = balDebit("0950","0960","0990"); // Долгосрочные отсроченные расходы

const line130 = line012.plus(line022).plus(line030).plus(line090)
                      .plus(line100).plus(line110).plus(line120);

// АКТИВ — Раздел II
const line150 = balDebit("1010","1020","1030","1040","1050","1060","1070","1080","1090",
                          "1110","1120","1510","1610");
const line160 = balDebit("2010","2110","2310","2510","2610","2710");
const line170 = balDebit("2810","2820","2830");
const line180 = balDebit("2910","2920","2930","2940","2950","2960","2970","2990")
                  .minus(balCredit("2980")); // − резерв (торговая наценка)
const line140 = line150.plus(line160).plus(line170).plus(line180);

const line190 = balDebit("3110","3120","3190");  // РБП
const line200 = balDebit("3210","3220","3290");  // Отсроченные расходы

// Дебиторы (строки 220-310)
const line220 = balDebit("4010","4020").minus(balCredit("4910")); // покупатели − резерв
const line230 = balDebit("4110");
const line240 = balDebit("4120");
const line250 = balDebit("4210","4220","4230","4290");
const line260 = balDebit("4310","4320","4330");
const line270 = balDebit("4410","4510","4520");  // аванс. платежи в бюджет + страх. + фонды
const line280 = new Decimal(0);                  // нет отдельных счётов в плане
const line290 = balDebit("4610");
const line300 = balDebit("4710","4720","4730","4790");
const line310 = balDebit("4810","4820","4830","4840","4850","4860","4890");
const line210 = line220.plus(line230).plus(line240).plus(line250)
                      .plus(line260).plus(line270).plus(line280)
                      .plus(line290).plus(line300).plus(line310);

// Деньги (строки 330-360)
const line330 = balDebit("5010","5020");
const line340 = balDebit("5110");
const line350 = balDebit("5210","5220");
const line360 = balDebit("5510","5520","5530","5610","5710");
const line320 = line330.plus(line340).plus(line350).plus(line360);

const line370 = balDebit("5810","5830","5890");  // Краткосрочные инвестиции
const line380 = balDebit("5910","5920");         // Прочие текущие активы

const line390 = line140.plus(line190).plus(line200).plus(line210)
                      .plus(line320).plus(line370).plus(line380);
const line400 = line130.plus(line390);           // ИТОГО АКТИВ

// ПАССИВ — Раздел I (Капитал)
const line410 = balCredit("8310","8320","8330");
const line420 = balCredit("8410","8420");
const line430 = balCredit("8510","8520","8530");
const line440 = balDebit("8610","8620");         // вычитается (CONTRA_LIABILITY)
const line450 = balCredit("8710");               // нераспределённая прибыль

// Текущий финрезультат (9910) — для открытых периодов
const line450ext = line450.plus(transitNet.lt(0) ? transitNet.abs() : new Decimal(0));
// transitNet < 0 → прибыль текущего года (добавляется к 8710)
// transitNet > 0 → убыток (вычитается)

const line460 = balCredit("8810","8820","8830","8840","8890");
const line470 = balCredit("8910");
const line480 = line410.plus(line420).plus(line430).minus(line440)
                      .plus(line450ext).plus(line460).plus(line470);

// ПАССИВ — Раздел II (Обязательства)
// Долгосрочные
const line500 = balCredit("7010","7020");
const line510 = balCredit("7110");
const line520 = balCredit("7120");
const line530 = balCredit("7210","7220","7230");
const line540 = balCredit("7240");
const line550 = balCredit("7250","7290");
const line560 = balCredit("7310");
const line570 = balCredit("7810");
const line580 = balCredit("7820","7830","7840");
const line590 = balCredit("7910","7920");
const line490 = line500.plus(line510).plus(line520).plus(line530).plus(line540)
                      .plus(line550).plus(line560).plus(line570).plus(line580).plus(line590);

// Текущие
const line610 = balCredit("6010","6020");
const line620 = balCredit("6110");
const line630 = balCredit("6120");
const line640 = balCredit("6210","6220","6230");
const line650 = balCredit("6240");
const line660 = balCredit("6250","6290");
const line670 = balCredit("6310","6320","6390");  // авансы полученные
const line680 = balCredit("6410");                // задолженность в бюджет
const line690 = balCredit("6510");
const line700 = balCredit("6520","6530");
const line710 = balCredit("6610","6620","6630");
const line720 = balCredit("6710","6720");
const line730 = balCredit("6810");
const line740 = balCredit("6820","6830","6840");
const line750 = balCredit("6950");
const line760 = balCredit("6910","6920","6930","6940","6960","6970","6990");
const line600 = [line610,line620,line630,line640,line650,line660,line670,line680,
                 line690,line700,line710,line720,line730,line740,line750,line760]
                .reduce((s,v) => s.plus(v), new Decimal(0));

const line770 = line490.plus(line600);
const line780 = line480.plus(line770);  // ИТОГО ПАССИВ

// Контрольная проверка
const balanceOk = line400.minus(line780).abs().lte(1);
Формат ответа — заменить текущую структуру sections на:


return NextResponse.json({
  asOf: endDate,
  balanceCheck: balanceOk,
  difference: line400.minus(line780).toNumber(),
  // Актив
  line010: line010.toNumber(), line011: line011.toNumber(), line012: line012.toNumber(),
  line020: line020.toNumber(), line021: line021.toNumber(), line022: line022.toNumber(),
  line030: line030.toNumber(),
  // ... все строки 040-780
  line130: line130.toNumber(),
  line390: line390.toNumber(),
  line400: line400.toNumber(),
  // Пассив
  line450: line450ext.toNumber(),
  line480: line480.toNumber(),
  line770: line770.toNumber(),
  line780: line780.toNumber(),
  // Детальные строки для разворачивания в UI
  details: {
    line610, line620, ..., line760  // для детального отображения
  }
});
B-4. closing.ts — Контрольная проверка взаимоувязки 8710 и Формы №2
Файл: lib/closing.ts

Спецификация: §8

Проблема: Проверка не реализована. Спецификация требует: если 8710_конец ≠ 8710_начало + ЧистаяПрибыль − Дивиденды → заблокировать закрытие периода.

Что делать:

В finalizePeriod(), после создания всех проводок (блок H), но до закрытия периода (блок I), добавить:


// Контроль §8: 8710_конец = 8710_начало + netProfit − dividends
const acc8710 = await tx.account.findUnique({ where: { code: ACCOUNTS.RETAINED_EARNINGS } });
if (acc8710) {
  // Сальдо 8710 на начало периода (до всех проводок этого периода)
  const start8710 = await tx.journalEntry.aggregate({
    where: {
      document: { orgId, status: "POSTED", date: { lt: new Date(period.year, period.month - 1, 1) } },
      accountId: acc8710.id
    },
    _sum: { credit: true, debit: true }
  });
  const balance8710Start = new Decimal(start8710._sum.credit?.toString() || "0")
    .minus(new Decimal(start8710._sum.debit?.toString() || "0"));

  // Дивиденды за период = Дт 8710 по документам типа DIVIDEND_PAYMENT
  const divEntries = await tx.journalEntry.findMany({
    where: {
      document: { orgId, periodId, status: "POSTED", type: { code: "DIVIDEND_PAYMENT" } },
      accountId: acc8710.id,
      debit: { gt: 0 }
    },
    select: { debit: true }
  });
  const dividends = divEntries.reduce(
    (s: Decimal, e: any) => s.plus(new Decimal(e.debit.toString())), new Decimal(0)
  );

  const expectedBalance8710End = balance8710Start.plus(netProfit).minus(dividends);

  // Сальдо 8710 на конец (после всех проводок этого периода, включая только что созданные)
  const end8710 = await tx.journalEntry.aggregate({
    where: { document: { orgId, status: "POSTED", date: { lte: accrualDate } }, accountId: acc8710.id },
    _sum: { credit: true, debit: true }
  });
  const balance8710End = new Decimal(end8710._sum.credit?.toString() || "0")
    .minus(new Decimal(end8710._sum.debit?.toString() || "0"));

  if (balance8710End.minus(expectedBalance8710End).abs().gt(1)) {
    throw new Error(
      `ОШИБКА ВЗАИМОУВЯЗКИ §8: Нераспределённая прибыль не сходится. ` +
      `Ожидается ${expectedBalance8710End.toFixed(2)}, факт ${balance8710End.toFixed(2)}. ` +
      `Проверьте проводки по счёту 8710.`
    );
  }
}
B-5. ensureBaseData.ts — Исправить шаблон REFUND: заменить 9030 на 9040
Файл: lib/ensureBaseData.ts

Строки: 249-258

Спецификация: §3.2 — возвраты используют счёт 9040

Проблема: REFUND дебетует счёт 9030 напрямую. По спецификации для возвратов выделен отдельный контрарный счёт 9040.

Что изменить:


// Было:
{ accountCode: "9030", side: "debit", expression: "amount" },

// Стало:
{ accountCode: "9040", side: "debit", expression: "amount" },
Примечание: Нужно убедиться, что счёт 9040 (Возврат проданных товаров) типа CONTRA_LIABILITY есть в COA — он уже есть в seed-coa.ts:265. Изменение не нарушает числовой результат (чистая выручка та же), но делает разрез корректным.

B-6. constants.ts + Org model — Ставка налога с оборота 1–4%
Файлы: lib/constants.ts, prisma/schema.prisma, app/api/settings/org/route.ts

Спецификация: §1 — «1–4% от выручки (зависит от вида деятельности)»

Проблема: Ставка захардкожена на 4%.

Что делать:

В prisma/schema.prisma добавить поле в модель Organization:

turnoverTaxRate  Float  @default(0.04)  // 0.01–0.04
Выполнить миграцию: npx prisma migrate dev --name add_turnover_tax_rate

В closing.ts и upsertTaxCalendarEventsForPeriod() заменить:

// Было:
const turnoverTaxAmt = totalRevenue.mul(TAX_RATES.TURNOVER_TAX);

// Стало:
const rate = new Decimal(org.turnoverTaxRate ?? TAX_RATES.TURNOVER_TAX);
const turnoverTaxAmt = totalRevenue.mul(rate);
В api/settings/org/route.ts (PUT-обработчик) добавить обработку поля turnoverTaxRate с валидацией: значение от 0.01 до 0.04.
B-7. api/pnl/route.ts — Убрать НДС из данных ответа
Спецификация: §4.3 — «НДС не входит в доходы и не входит в расходы»

Что делать:

В ответе API не возвращать поля salesVat, vatInput, vatInputLines, netVat. Эти данные относятся к налоговому учёту НДС, а не к Форме №2. Если нужна справка по НДС — отдельный API-эндпоинт /api/reports/vat-summary.

ЧАСТЬ 2 — FRONTEND
F-1. PnLClient.tsx — Переименовать страницу, убрать «P&L»
Файл: app/pnl/PnLClient.tsx

Спецификация: §9.1

Строка	Было	Стало
127	"P&L (Прибыли и убытки)"	"Отчёт о финансовых результатах"
129	"Отчет о финансовых результатах (метод начисления)"	оставить
95	"Загрузка отчёта P&L..."	"Загрузка Формы №2..."
В page.tsx (путь app/pnl/page.tsx) проверить и исправить <title> и метаданные страницы.

F-2. PnLClient.tsx — Полностью переписать таблицу под официальные строки Формы №2
Файл: app/pnl/PnLClient.tsx

Спецификация: §3.1, §9.1

Данные теперь приходят из нового API (B-2) в виде lines.lineXXX.

Структура таблицы (строки в порядке сверху вниз):


┌─ ДОХОДЫ ──────────────────────────────────────────────────┐
│ стр. 010  Чистая выручка от реализации          [line010] │
│ стр. 020  Себестоимость реализованной продукции [line020] │
├───────────────────────────────────────────────────────────┤
│ стр. 030  ВАЛОВАЯ ПРИБЫЛЬ (УБЫТОК)              [line030] │  ← жирная строка
├─ РАСХОДЫ ПЕРИОДА ─────────────────────────────────────────┤
│ стр. 050    Расходы по реализации               [line050] │
│ стр. 060    Административные расходы            [line060] │
│ стр. 070    Прочие операционные расходы         [line070] │
│ стр. 040  Расходы периода, итого                [line040] │  ← полужирная
│ стр. 090  Прочие доходы от осн. деятельности   [line090] │
├───────────────────────────────────────────────────────────┤
│ стр. 100  ПРИБЫЛЬ ОТ ОСНОВНОЙ ДЕЯТЕЛЬНОСТИ     [line100] │  ← жирная строка
├─ ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ ─────────────────────────────────┤
│ стр. 110  Доходы от фин. деятельности, итого   [line110] │
│   стр. 130  — в т.ч. доходы в виде процентов  [line130] │  ← если > 0
│   стр. 150  — в т.ч. курсовые разницы (+)     [line150] │  ← если > 0
│ стр. 170  Расходы по фин. деятельности, итого  [line170] │
│   стр. 180  — в т.ч. расходы по процентам     [line180] │  ← если > 0
│   стр. 200  — в т.ч. курсовые убытки          [line200] │  ← если > 0
├───────────────────────────────────────────────────────────┤
│ стр. 220  ПРИБЫЛЬ ОТ ОБЩЕХОЗ. ДЕЯТЕЛЬНОСТИ    [line220] │  ← жирная строка
│ стр. 230  Чрезвычайные прибыли/убытки (±)     [line230] │  ← если ≠ 0
├───────────────────────────────────────────────────────────┤
│ стр. 240  ПРИБЫЛЬ ДО УПЛАТЫ НАЛОГА             [line240] │  ← жирная строка
│ стр. 250  Налог на прибыль (15%) /             [line250] │
│           Налог с оборота (X%)                          │
│ стр. 260  Прочие налоги от прибыли             [line260] │  ← если > 0
├───────────────────────────────────────────────────────────┤
│ стр. 270  ЧИСТАЯ ПРИБЫЛЬ (УБЫТОК)              [line270] │  ← жирная, крупный шрифт
└───────────────────────────────────────────────────────────┘
Правила отображения:

Строки без данных (= 0) — скрывать (кроме 030, 100, 220, 240, 270 — эти всегда видны)
Жирные итоговые строки: 030, 100, 220, 240, 270
Строки-детали с отступом (050-080, 120-160, 180-210) выводить только если их значение ≠ 0
Отрицательные значения — красным цветом в скобках
НДС-строки (salesVat, vatInput) — полностью убрать из таблицы
Ставка налога в стр. 250:

VAT-режим: "Налог на прибыль (15%)"
TURNOVER_TAX: "Налог с оборота (${(org.turnoverTaxRate * 100).toFixed(0)}%)" — брать ставку из ответа API
F-3. balance/page.tsx — Полностью переписать таблицу под официальные строки Формы №1
Файл: app/reports/balance/page.tsx

Спецификация: §2, §9.1

Данные теперь приходят из нового API (B-3) с полями line010-line780.

Структура страницы — два столбца (АКТИВ / ПАССИВ), как сейчас, но с официальными строками:

АКТИВ:


Раздел I. Долгосрочные активы
  010  Основные средства: первоначальная стоимость
  011  − Износ
  012  Остаточная стоимость ОС                       ← жирная
  020  НМА: первоначальная стоимость
  021  − Амортизация НМА
  022  Остаточная стоимость НМА                      ← жирная
  030  Долгосрочные инвестиции (040+050+060+070+080)
  090  Оборудование к установке
  100  Капитальные вложения
  110  Долгосрочная дебиторская задолженность
  120  Долгосрочные отсроченные расходы
  130  ИТОГО Раздел I                                ← жирная, фон

Раздел II. Текущие активы
  140  ТМЗ (150+160+170+180)
  190  Расходы будущих периодов
  200  Отсроченные расходы
  210  Дебиторы, итого (220+...+310)
    220  покупатели и заказчики
    260  авансы поставщикам
    270  авансы по налогам (4410 → сюда)
    300  задолженность персонала
  320  Денежные средства (330+340+350+360)
  370  Краткосрочные инвестиции
  380  Прочие текущие активы
  390  ИТОГО Раздел II                               ← жирная, фон
  400  ВСЕГО ПО АКТИВУ                               ← жирная, тёмный фон
ПАССИВ:


Раздел I. Собственный капитал
  410  Уставный капитал
  420  Добавленный капитал
  430  Резервный капитал
  440  − Выкупленные акции
  450  Нераспределённая прибыль / Финрезультат тек.года
  460  Целевые поступления
  470  Резервы предстоящих расходов
  480  ИТОГО Раздел I                                ← жирная, фон

Раздел II. Обязательства
  490  Долгосрочные обязательства, итого
    500-590 (детали)
  600  Текущие обязательства, итого
    610  поставщики
    670  Авансы полученные (6310)
    680  Задолженность по платежам в бюджет (6410)
    690  Страхование
    700  Государственные фонды
    720  Задолженность по оплате труда
    730  Краткосрочные кредиты
    760  Прочие
  770  ИТОГО Раздел II                               ← жирная, фон
  780  ВСЕГО ПО ПАССИВУ                              ← жирная, тёмный фон
Правила отображения:

Строки с нулевым значением — скрывать (кроме итоговых: 130, 390, 400, 480, 770, 780)
Строки-детали (040-080, 220-310, 330-360, 500-590, 610-760) — раскрывающиеся по клику на родительскую строку
Номер строки (010-780) отображать серым шрифтом слева от названия
Строки 011, 021, 440 — вычитаемые, отображать со знаком минус
Индикатор баланса: 400 = 780 → зелёная строка; расхождение → красная с суммой расхождения
F-4. Настройки организации — Добавить поле «Ставка налога с оборота»
Файл: app/settings/page.tsx

Спецификация: §1

На странице настроек организации, в блоке налогового режима (где переключатель VAT/TURNOVER_TAX), добавить поле:


Ставка налога с оборота:
[  4  ] %   (от 1 до 4)
Поле видно только когда выбран режим TURNOVER_TAX.
Сохранять через PUT /api/settings/org с полем turnoverTaxRate: number.

F-5. Sidebar / навигация — Обновить названия пунктов меню
Файл: components/Layout/Sidebar.tsx

Было	Стало
«P&L» / «Прибыли и убытки»	«Форма №2 — Отчёт о финансовых результатах»
«Баланс» / «Balance»	«Форма №1 — Бухгалтерский баланс»
Порядок выполнения задач
Приоритет	Задача	Почему
1	B-1 (налог с оборота: проводка 9810)	Ломает 8710, закрытие периода, Форму №2 для TURNOVER_TAX
2	B-2 (API Формы №2: строки 010-270)	Нет ни одной официальной строки
3	F-2 (UI Формы №2: переписать таблицу)	Зависит от B-2
4	B-3 (API Формы №1: строки 010-780)	Нет официальных строк, 4410 не в нужном месте
5	F-3 (UI Формы №1: переписать таблицу)	Зависит от B-3
6	B-4 (проверка взаимоувязки §8)	Защита от ошибок в проводках
7	B-5 (REFUND → 9040)	Исправление без поломки функциональности
8	B-6 (ставка налога с оборота)	Схема + API + настройки
9	F-4 (поле ставки в UI)	Зависит от B-6
10	F-1 + F-5 (терминология)	Чисто UI, не зависит от backend
11	B-7 (убрать НДС из ответа pnl)	Зависит от F-2 (UI уже не использует эти поля)
