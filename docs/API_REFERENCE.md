# Справочник API v2.0

Все запросы требуют активной сессии (cookie `session`). При отсутствии сессии — `401 Unauthorized`.

---

## Организации

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/organizations` | Список организаций пользователя |
| `POST` | `/api/organizations` | Создать организацию (`name`, `inn`) |
| `PATCH` | `/api/organizations/[id]` | Обновить реквизиты |
| `DELETE` | `/api/organizations/[id]` | Удалить организацию (каскадное удаление всех данных) |
| `POST` | `/api/organizations/switch` | Переключить активную организацию |

---

## Счета

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/accounts` | Активные счета текущей организации |
| `POST` | `/api/accounts` | Активировать счёт из MasterAccount (`master_account_id`) |
| `PATCH` | `/api/accounts/[id]/toggle` | Включить/выключить счёт (с проверкой наличия транзакций) |

**Тело `POST /api/accounts`:**
```json
{ "master_account_id": "uuid" }
```

---

## Транзакции

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/transactions` | Журнал проводок (с пагинацией и фильтрами) |
| `POST` | `/api/transactions` | Создать проводку |
| `DELETE` | `/api/transactions/[id]` | Мягкое удаление (`is_deleted: true`) |

**Тело `POST /api/transactions`:**
```json
{
  "date": "2026-01-31",
  "period": "01.2026",
  "description": "Аренда офиса январь",
  "amount": 500000,
  "debit_id": "uuid счёта дебета",
  "credit_id": "uuid счёта кредита",
  "counterparty_id": "uuid (необязательно)"
}
```

---

## AI

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/ai/chat` | Отправить сообщение AI, получить проводки |
| `POST` | `/api/ai/execute` | Создать проводки из ответа AI |

**Тело `POST /api/ai/chat`:**
```json
{
  "message": "Оплатили аренду 500 000 сум с банка",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Ответ `POST /api/ai/chat`:**
```json
{
  "explanation": "Объяснение проводок",
  "action": {
    "type": "CREATE_TRANSACTIONS",
    "transactions": [
      {
        "step": 1,
        "step_label": "Оплата аренды",
        "description": "Аренда офиса",
        "amount": 500000,
        "date": "2026-01-31",
        "period": "01.2026",
        "debit":  { "code": "9420", "name": "Административные расходы", "is_missing": false },
        "credit": { "code": "5110", "name": "Расчётный счёт", "is_missing": false }
      }
    ]
  }
}
```

**Тело `POST /api/ai/execute`:**
```json
{
  "transactions": [ ...массив транзакций из ответа AI... ]
}
```
Или одиночный формат:
```json
{ "data": { ...одна транзакция... } }
```

---

## Отчёты

| Метод | Путь | Параметры | Описание |
|---|---|---|---|
| `GET` | `/api/reports/osv` | `?period=01.2026` | Оборотно-сальдовая ведомость |
| `GET` | `/api/reports/balance` | `?date=2026-01-31` | Баланс (Форма 1) |
| `GET` | `/api/reports/pnl` | `?period=01.2026` | ОФР (Форма 2) |
| `GET` | `/api/reports/dashboard` | — | KPI: выручка, расходы, прибыль, банк, касса |
| `GET` | `/api/reports/opening-balance` | — | Статус начальных остатков (счёт 0000) |

---

## Настройки

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/settings` | Настройки текущей организации |
| `POST` | `/api/settings` | Обновить `closed_period_date`, `opening_balance_date` |

---

## Онбординг

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/templates` | Список 22 отраслевых шаблонов |
| `POST` | `/api/onboarding/apply-template` | Активировать план счетов (`mode=full` или `mode=template` + `templateId`) |

---

## Контрагенты

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/counterparties` | Список контрагентов |
| `POST` | `/api/counterparties` | Создать контрагента |
| `DELETE` | `/api/counterparties/[id]` | Удалить контрагента |

---

*Contador v2.0 — API Reference*
