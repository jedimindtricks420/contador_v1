# Справочник кода для разработки ИИ (v2.1)

Этот документ содержит ключевые фрагменты логики приложения Contador, необходимые для реализации функций в эндпоинтах `/src/app/api/ai/` и библиотеках `/src/lib/ai/`.

---

## 1. Авторизация и Контекст
**Файл:** `src/lib/context.ts`
Позволяет получить ID активной организации для фильтрации данных в ИИ-запросах.

```typescript
export async function getActiveOrganizationId(): Promise<string> {
  const sessionToken = (await cookies()).get("session")?.value;
  if (!sessionToken) throw new Error("Unauthorized");

  const payload = await decrypt(sessionToken);
  const userId = payload.user?.id;
  if (!userId) throw new Error("Invalid session");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { active_org_id: true }
  });

  if (!user?.active_org_id) {
    throw new Error("No active organization found for user");
  }

  return user.active_org_id;
}
```

---

## 2. Логика Транзакций (Проводки)
**Файл:** `src/app/api/transactions/route.ts`
Обратите внимание на валидацию `closed_period_date` и формат `period`.

```typescript
// Схема валидации (Zod)
const transactionSchema = z.object({
  date: z.string(),
  period: z.string(), // Формат "MM.YYYY"
  description: z.string(),
  amount: z.number().positive(),
  debit_id: z.string(),
  credit_id: z.string(),
  counterparty_id: z.string().optional().nullable(),
})

// Проверка закрытого периода
const settings = await prisma.systemSettings.findUnique({
  where: { organization_id: organizationId }
})
if (settings && new Date(validated.date) <= settings.closed_period_date) {
  return NextResponse.json({ error: 'Период закрыт для редактирования' }, { status: 400 })
}

// Создание записи
const result = await tx.transaction.create({
  data: {
    date: new Date(validated.date),
    period: validated.period, // "03.2026"
    description: validated.description,
    amount: new Decimal(validated.amount),
    debit_id: validated.debit_id,
    credit_id: validated.credit_id,
    organization_id: organizationId
  },
})
```

---

## 3. Активация Счетов
**Файл:** `src/app/api/accounts/route.ts`
Как счет связывается с эталонным планом НСБУ (`MasterAccount`).

```typescript
if (body.master_account_id) {
  // Копирование из Мастер-счета
  const master = await prisma.masterAccount.findUnique({
    where: { id: body.master_account_id }
  })
  accountData = {
    code: master.code,
    name: master.name,
    type: master.type,
    organization_id: organizationId,
    master_account_id: master.id,
    is_active: true,
    is_custom: false,
  }
}
// Upsert позволяет избежать дублей по коду внутри одной организации
const account = await prisma.account.upsert({
  where: {
    code_organization_id: {
      code: accountData.code,
      organization_id: organizationId,
    }
  },
  create: accountData,
  update: { is_active: true },
})
```

---

## 4. Интерфейс и Состояние Чата
**Файлы:** `src/lib/ui-context.tsx` и `src/components/AIChat.tsx`

```typescript
// Состояние (UI Context)
interface UIContextType {
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  toggleChat: () => void;
}

// Компонент (AIChat)
export default function AIChat() {
  const { isChatOpen, setIsChatOpen, toggleChat } = useUI();
  // ...
  return (
    <div className={`fixed ... ${isChatOpen ? "translate-x-0" : "translate-x-full"}`}>
       {/* Контент чата */}
    </div>
  )
}
```

---

## 5. Модели Данных (Prisma)
**Файл:** `prisma/schema.prisma`

```prisma
model Account {
  id                String        @id @default(uuid())
  code              String
  name              String
  type              AccountType
  organization_id   String
  master_account_id String?
  is_active         Boolean       @default(true)
  // ...
  @@unique([code, organization_id])
}

model Transaction {
  id              String       @id @default(uuid())
  date            DateTime
  period          String       // MM.YYYY
  description     String
  amount          Decimal      @db.Decimal(20, 2)
  debit_id        String
  credit_id       String
  organization_id String
  is_deleted      Boolean      @default(false)
  // ...
}
```

---
*Документ подготовлен специально для разработки модуля `/api/ai`.*
