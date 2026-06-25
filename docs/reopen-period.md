# Доработка: Переоткрытие закрытого периода

## Что нужно реализовать

Пользователь должен иметь возможность вернуть закрытый период в статус `OPEN` и продолжить редактирование транзакций. Функция доступна:
- **Пользователю** — через UI страницы `/closing` (только для периодов, закрытых менее 30 дней назад)
- **Администратору** — через панель управления `contador.uz/admin/` без ограничений

---

## Как работает закрытие периода сейчас

`finalizePeriod()` в `v2/src/lib/closing.ts` выполняет следующие шаги:

| Шаг | Что создаётся | Document.type.code |
|-----|---------------|-------------------|
| A | Начисление ЗП и налогов ФОТ | `SALARY_ACCRUAL` |
| B | Начисление амортизации | `DEPRECIATION_ACCRUAL` |
| C | Начисление аренды | `RENT_ACCRUAL` |
| D | Курсовые разницы | `FX_DIFFERENCE` |
| E | Налог на прибыль | `PROFIT_TAX_ACCRUAL` |
| G | Реформация баланса (перенос на сч. 9910) | `PERIOD_CLOSING` |
| F | Налоговый календарь | `TaxCalendarEvent` записи |
| — | Блокировка периода | `period.status = CLOSED`, `period.lockDate = lastDay` |

Все данные мастера закрытия хранятся в `period.closingData` (JSON).

---

## Что блокирует редактирование в закрытом периоде

В API проверяется условие `period.status === "CLOSED" || period.lockDate !== null`:

| Файл | Что блокирует |
|------|--------------|
| `api/transactions/[id]/category/route.ts:41` | Смена категории транзакции |
| `api/transactions/[id]/skip/route.ts:34` | Пропуск транзакции |
| `api/documents/route.ts:67` | Создание нового документа |
| `api/open-items/[id]/close/route.ts:34` | Закрытие открытой позиции |
| `api/import/bank/route.ts:93` | Импорт банковской выписки |

---

## Что нужно сделать при переоткрытии (логика отката)

### 1. Удалить системные документы закрытия и их проводки

Документы, созданные `finalizePeriod()`, нужно удалить. Их `JournalEntry` удалятся каскадом (`onDelete: Cascade` на связи `Document → JournalEntry`).

```
Удалить Document WHERE periodId = :id AND type.code IN:
  - PERIOD_CLOSING
  - SALARY_ACCRUAL
  - DEPRECIATION_ACCRUAL
  - RENT_ACCRUAL
  - FX_DIFFERENCE
  - PROFIT_TAX_ACCRUAL
```

> **Важно:** Документы банковских транзакций (`BANK_INCOME`, `BANK_EXPENSE` и т.д.) **не трогать** — они были созданы пользователем до закрытия и должны остаться.

### 2. Удалить налоговые события периода

```
Удалить TaxCalendarEvent WHERE periodId = :id AND status = "PENDING"
```

### 3. Сбросить статус периода

```sql
UPDATE Period SET
  status = "OPEN",
  lockDate = NULL,
  closingData = NULL
WHERE id = :id
```

### 4. Сбросить кэш мастера закрытия

В `v2/src/lib/closing.ts` есть in-memory кэш `closingStates: Map<string, any>`. При переоткрытии нужно вызвать `closingStates.delete(periodId)`.

---

## Файлы для создания / изменения

### Новые файлы

#### `v2/src/app/api/periods/[id]/reopen/route.ts` — основная логика

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgId } from "@/lib/context";
import prisma from "@/lib/prisma";
// closingStates нужно экспортировать из lib/closing.ts (сейчас не экспортируется)
import { clearClosingState } from "@/lib/closing";

const CLOSING_DOC_CODES = [
  "PERIOD_CLOSING",
  "SALARY_ACCRUAL",
  "DEPRECIATION_ACCRUAL",
  "RENT_ACCRUAL",
  "FX_DIFFERENCE",
  "PROFIT_TAX_ACCRUAL",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({ where: { id, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }
    if (period.status !== "CLOSED") {
      return NextResponse.json({ error: "Период не закрыт" }, { status: 400 });
    }

    // Опциональная защита: запрещать переоткрытие если прошло > 30 дней
    // (раскомментировать по решению команды)
    // const daysSinceLock = period.lockDate
    //   ? (Date.now() - period.lockDate.getTime()) / (1000 * 60 * 60 * 24)
    //   : 0;
    // if (daysSinceLock > 30) {
    //   return NextResponse.json({
    //     error: "Период закрыт более 30 дней назад. Обратитесь к администратору."
    //   }, { status: 403 });
    // }

    await prisma.$transaction(async (tx) => {
      // 1. Найти системные документы закрытия
      const closingDocs = await tx.document.findMany({
        where: {
          orgId,
          periodId: id,
          type: { code: { in: CLOSING_DOC_CODES } },
        },
        select: { id: true },
      });
      const closingDocIds = closingDocs.map((d) => d.id);

      // 2. Удалить OpenItem связанные с документами закрытия (если есть)
      if (closingDocIds.length > 0) {
        await tx.openItem.deleteMany({
          where: {
            OR: [
              { openingDocumentId: { in: closingDocIds } },
              { closingDocumentId: { in: closingDocIds } },
            ],
          },
        });
        // JournalEntry удалятся каскадом вместе с Document
        await tx.document.deleteMany({
          where: { id: { in: closingDocIds } },
        });
      }

      // 3. Удалить налоговые события этого периода (PENDING)
      await tx.taxCalendarEvent.deleteMany({
        where: { orgId, periodId: id, status: "PENDING" },
      });

      // 4. Разблокировать период
      await tx.period.update({
        where: { id },
        data: {
          status: "OPEN",
          lockDate: null,
          closingData: null,
        },
      });
    });

    // 5. Сбросить in-memory кэш мастера закрытия
    clearClosingState(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("REOPEN PERIOD ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
```

---

### Изменения в существующих файлах

#### `v2/src/lib/closing.ts` — экспортировать функцию сброса кэша

Добавить после объявления `closingStates`:

```typescript
// Добавить экспорт для reopen
export function clearClosingState(periodId: string) {
  closingStates.delete(periodId);
}
```

---

#### `v2/src/app/closing/page.tsx` — кнопка переоткрытия в UI

В секции header рядом с кнопкой "Удалить период" добавить кнопку переоткрытия.

**Добавить state:**
```typescript
const [reopening, setReopening] = useState(false);
```

**Добавить handler:**
```typescript
const handleReopenPeriod = async () => {
  if (!selectedPeriod) return;
  if (!confirm(`Переоткрыть период ${periodLabel(selectedPeriod.year, selectedPeriod.month)}? Проводки закрытия будут удалены.`)) return;
  setReopening(true);
  try {
    const res = await fetch(`/v2/api/periods/${selectedPeriod.id}/reopen`, { method: "POST" });
    if (res.ok) {
      await loadPeriods(selectedPeriod.id);
    } else {
      const data = await res.json();
      alert(`Ошибка: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setReopening(false);
  }
};
```

**Добавить кнопку** (рядом с кнопкой удаления, показывать только для CLOSED периодов):
```tsx
{selectedPeriod && selectedPeriod.status === "CLOSED" && (
  <button
    onClick={handleReopenPeriod}
    disabled={reopening}
    className="text-xs border border-amber-200 text-amber-600 hover:bg-amber-50 font-semibold py-1.5 px-3 transition disabled:opacity-50"
  >
    {reopening ? "Открываем..." : "↩ Переоткрыть"}
  </button>
)}
```

---

#### Панель администратора `admin/public/index.html`

Уже имеется эндпоинт `PATCH /api/v2/periods/:periodId/status` (`admin/server.ts:861`), который устанавливает `status = "OPEN"` и обнуляет `lockDate`. **Но он не удаляет системные документы закрытия.**

Либо:
- **Вариант А:** Использовать существующий PATCH только как "экстренный override" (без удаления документов), а полноценный реоткрытие делать только через `/api/periods/[id]/reopen`
- **Вариант Б:** В `admin/server.ts` добавить отдельный маршрут `POST /v2/periods/:periodId/reopen` который вызывает полную логику отката

Рекомендуется **Вариант А** для простоты: пользователи используют `/closing` UI, администраторы могут "грубо" разблокировать через статус-патч если нужно без отката документов.

---

## Граничные случаи и предупреждения

### ⚠️ Стыковка периодов (year-end)

Если после закрытия этого периода был запущен **перенос остатков на следующий год** (`/api/closing/year-end`), переоткрытие текущего периода НЕ откатит проводки следующего года. Нужно добавить проверку:

```typescript
// В reopen route, перед транзакцией:
const hasYearEndFollower = await prisma.document.findFirst({
  where: {
    orgId,
    type: { code: "YEAR_END_TRANSFER" },
    period: { year: period.year + (period.month === 12 ? 1 : 0) }
  }
});
if (hasYearEndFollower) {
  return NextResponse.json({
    error: "Нельзя переоткрыть: уже выполнен перенос остатков на следующий год."
  }, { status: 400 });
}
```

### ⚠️ Транзакции со статусом POSTED

Транзакции `StagedTransaction` со статусом `POSTED` (уже разнесены по счетам) остаются нетронутыми — они редактировались пользователем до закрытия. После переоткрытия пользователь может их переклассифицировать.

### ⚠️ Налоговый календарь

Удаляются только события со статусом `PENDING`. События `PAID` или `OVERDUE` не трогаются — они отражают факт уплаты налогов.

### ⚠️ OpenItems (дебиторка/кредиторка)

OpenItems, созданные до закрытия периода, не трогаются. Только OpenItems привязанные к системным документам закрытия (`PERIOD_CLOSING` и т.д.) удаляются — но их там обычно нет, т.к. `opensItem: false` в postingTemplate этих типов.

---

## Тест-сценарий

1. Закрыть период через мастер (`/closing`)
2. Убедиться что `period.status === "CLOSED"` и `period.lockDate` установлен
3. Убедиться что редактирование транзакций заблокировано (`403` на `/api/transactions/:id/category`)
4. Нажать "↩ Переоткрыть" в UI
5. Убедиться что:
   - `period.status === "OPEN"`, `lockDate = null`, `closingData = null`
   - Документы `PERIOD_CLOSING`, `SALARY_ACCRUAL` и т.д. удалены
   - Документы банковских транзакций остались
   - `TaxCalendarEvent` со статусом `PENDING` удалены
   - Редактирование транзакций снова доступно
6. Повторно закрыть период через мастер — должен пройти полный цикл

---

## Итого: объём работ

| Задача | Файл | Размер |
|--------|------|--------|
| Новый API endpoint | `v2/src/app/api/periods/[id]/reopen/route.ts` | ~70 строк |
| Экспорт `clearClosingState` | `v2/src/lib/closing.ts` | +4 строки |
| Кнопка и handler в UI | `v2/src/app/closing/page.tsx` | +25 строк |
| (опц.) Проверка year-end | `reopen/route.ts` | +10 строк |

Итого: **~110 строк нового кода**, без изменения схемы БД.
