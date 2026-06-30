#!/bin/bash
# Тестирование Payme Merchant API для contador
# Симулирует запросы, которые Payme отправляет на наш webhook
#
# Webhook URL (prod): https://contador.uz/admin/api/v2/payments/payme
# Способ авторизации: Basic Auth — Paycom:<PAYME_TEST_KEY>
# payme_env: test  →  используется payme_test_key
#
# Использование:
#   ./test-payme.sh                    # тест локально (localhost:3031)
#   ./test-payme.sh --prod             # тест через публичный URL

set -e

# ─── CONFIG ────────────────────────────────────────────────────
PAYME_TEST_KEY="S9D47XBCDaYAfK58EUozsCe27noMB1NJpz?9"
LOCAL_URL="http://localhost:3031/admin/api/v2/payments/payme"
PUBLIC_URL="https://contador.uz/admin/api/v2/payments/payme"

if [ "$1" = "--prod" ]; then
  PAYME_URL="$PUBLIC_URL"
  echo "⚠  Используем публичный URL: $PUBLIC_URL"
else
  PAYME_URL="$LOCAL_URL"
  echo "ℹ  Используем локальный URL: $LOCAL_URL"
fi

AUTH_HEADER="Authorization: Basic $(echo -n "Paycom:${PAYME_TEST_KEY}" | base64 -w 0)"
AMOUNT=29900000          # 299000 UZS × 100 тийин
NOW_MS=$(($(date +%s) * 1000))

# ─── HELPER FUNCTIONS ──────────────────────────────────────────
payme() {
  local method="$1"
  local params="$2"
  local req_id="$3"
  curl -s -X POST "$PAYME_URL" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"method\":\"$method\",\"params\":$params,\"id\":$req_id}"
}

check_ok() {
  local label="$1"
  local response="$2"
  local expect="$3"   # строка, которую ищем в ответе
  if echo "$response" | grep -q "$expect"; then
    echo "  ✅ $label"
  else
    echo "  ❌ $label"
    echo "     Response: $response"
    return 1
  fi
}

check_error() {
  local label="$1"
  local response="$2"
  local code="$3"
  if echo "$response" | grep -q "\"code\":$code"; then
    echo "  ✅ $label (ошибка $code — ожидается)"
  else
    echo "  ❌ $label — ожидался код $code"
    echo "     Response: $response"
    return 1
  fi
}

# ─── ПОЛУЧАЕМ ТЕСТОВЫЕ ПЛАТЕЖИ ИЗ БД ──────────────────────────
echo ""
echo "📦 Получаем PENDING-платежи из БД..."
PAYMENTS=$(docker exec contador-admin node -e "
const { PrismaClient } = require('/app/v2/node_modules/.prisma/client');
const { randomBytes } = require('crypto');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://user:password@db:5432/contador_v2' } } });
async function main() {
  let pending = await prisma.payment.findMany({
    where: { status: 'PENDING', externalId: { startsWith: 'PENDING_' }, provider: 'PAYME' },
    orderBy: { createdAt: 'asc' },
    take: 3
  });
  if (pending.length < 3) {
    // создаём недостающие
    const orgId = '788b95f2-2130-4b59-bf92-c9111318c763';
    const need = 3 - pending.length;
    for (let i = 0; i < need; i++) {
      const p = await prisma.payment.create({ data: { orgId, provider: 'PAYME', externalId: 'PENDING_' + randomBytes(8).toString('hex'), amount: 299000, currency: 'UZS', status: 'PENDING', daysGranted: 365 } });
      pending.push(p);
    }
  }
  console.log(pending.map(p => p.id).join(' '));
}
main().catch(console.error).finally(() => prisma.\$disconnect());
" 2>/dev/null)

read -r PAY1 PAY2 PAY3 <<< "$PAYMENTS"
if [ -z "$PAY1" ] || [ -z "$PAY2" ] || [ -z "$PAY3" ]; then
  echo "❌ Не удалось получить тестовые платежи. Проверьте Docker."
  exit 1
fi
echo "  Платёж 1 (success flow):  $PAY1"
echo "  Платёж 2 (cancel flow):   $PAY2"
echo "  Платёж 3 (error cases):   $PAY3"

TRANS1="payme-test-success-$(date +%s)"
TRANS2="payme-test-cancel-$(date +%s)c"

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 1: Авторизация"
echo "══════════════════════════════════════════════"

R=$(curl -s -X POST "$PAYME_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'Paycom:wrong-key' | base64 -w 0)" \
  -d "{\"method\":\"CheckPerformTransaction\",\"params\":{\"amount\":$AMOUNT,\"account\":{\"order_id\":\"$PAY1\"}},\"id\":99}")
check_error "Неверный ключ → AUTH_ERROR (-32504)" "$R" "-32504"

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 2: CheckPerformTransaction"
echo "══════════════════════════════════════════════"

R=$(payme "CheckPerformTransaction" "{\"amount\":$AMOUNT,\"account\":{\"order_id\":\"$PAY1\"}}" 1)
check_ok "Корректный заказ → allow:true" "$R" '"allow":true'

R=$(payme "CheckPerformTransaction" "{\"amount\":$AMOUNT,\"account\":{\"order_id\":\"00000000-0000-0000-0000-000000000000\"}}" 2)
check_error "Несуществующий заказ → ORDER_NOT_FOUND (-31050)" "$R" "-31050"

R=$(payme "CheckPerformTransaction" "{\"amount\":999,\"account\":{\"order_id\":\"$PAY1\"}}" 3)
check_error "Неверная сумма → WRONG_AMOUNT (-31001)" "$R" "-31001"

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 3: CreateTransaction"
echo "══════════════════════════════════════════════"

R=$(payme "CreateTransaction" "{\"id\":\"$TRANS1\",\"time\":$NOW_MS,\"amount\":$AMOUNT,\"account\":{\"order_id\":\"$PAY1\"}}" 4)
check_ok "Создание транзакции → state:1" "$R" '"state":1'
create_time=$(echo "$R" | grep -o '"create_time":[0-9]*' | head -1 | cut -d: -f2)

# Идемпотентность: повторный вызов с тем же ID
R=$(payme "CreateTransaction" "{\"id\":\"$TRANS1\",\"time\":$NOW_MS,\"amount\":$AMOUNT,\"account\":{\"order_id\":\"$PAY1\"}}" 5)
check_ok "Повторный Create (идемпотентность) → state:1" "$R" '"state":1'

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 4: PerformTransaction"
echo "══════════════════════════════════════════════"

R=$(payme "PerformTransaction" "{\"id\":\"$TRANS1\"}" 6)
check_ok "Выполнение транзакции → state:2" "$R" '"state":2'

# Идемпотентность: повторный вызов
R=$(payme "PerformTransaction" "{\"id\":\"$TRANS1\"}" 7)
check_ok "Повторный Perform (идемпотентность) → state:2" "$R" '"state":2'

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 5: CheckTransaction (после оплаты)"
echo "══════════════════════════════════════════════"

R=$(payme "CheckTransaction" "{\"id\":\"$TRANS1\"}" 8)
check_ok "CheckTransaction → state:2 (SUCCESS)" "$R" '"state":2'
check_ok "perform_time присутствует и > 0" "$R" '"perform_time":[1-9]'

R=$(payme "CheckTransaction" "{\"id\":\"несуществующий-trans\"}" 9)
check_error "Несуществующая транзакция → TRANSACTION_NOT_FOUND (-31003)" "$R" "-31003"

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 6: CheckPerformTransaction (после оплаты)"
echo "══════════════════════════════════════════════"

R=$(payme "CheckPerformTransaction" "{\"amount\":$AMOUNT,\"account\":{\"order_id\":\"$PAY1\"}}" 10)
check_error "Уже оплаченный заказ → ORDER_ALREADY_PAID (-31052)" "$R" "-31052"

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 7: CancelTransaction (до оплаты)"
echo "══════════════════════════════════════════════"

R=$(payme "CreateTransaction" "{\"id\":\"$TRANS2\",\"time\":$NOW_MS,\"amount\":$AMOUNT,\"account\":{\"order_id\":\"$PAY2\"}}" 11)
check_ok "Create для cancel-теста → state:1" "$R" '"state":1'

R=$(payme "CancelTransaction" "{\"id\":\"$TRANS2\",\"reason\":5}" 12)
check_ok "Отмена до оплаты → state:-1" "$R" '"state":-1'

# Идемпотентность отмены
R=$(payme "CancelTransaction" "{\"id\":\"$TRANS2\",\"reason\":5}" 13)
check_ok "Повторная отмена (идемпотентность) → state:-1" "$R" '"state":-1'

R=$(payme "CheckTransaction" "{\"id\":\"$TRANS2\"}" 14)
check_ok "CheckTransaction после отмены → state:-1" "$R" '"state":-1'
check_ok "cancel_time > 0" "$R" '"cancel_time":[1-9]'
check_ok "reason:5" "$R" '"reason":5'

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 8: GetStatement"
echo "══════════════════════════════════════════════"

FROM_MS=$(date -d "$(date +%Y-%m-01)" +%s000 2>/dev/null || echo "$(($(date +%s) * 1000 - 2592000000))")
TO_MS=$(date -d "$(date -d 'next month' +%Y-%m-01)" +%s000 2>/dev/null || echo "$(($(date +%s) * 1000 + 86400000))")

R=$(payme "GetStatement" "{\"from\":$FROM_MS,\"to\":$TO_MS}" 15)
check_ok "GetStatement возвращает список транзакций" "$R" '"transactions"'
TX_COUNT=$(echo "$R" | grep -o '"id":"payme' | wc -l)
echo "  ℹ  Транзакций в периоде: $TX_COUNT"

echo ""
echo "══════════════════════════════════════════════"
echo " ТЕСТ 9: Метод не найден"
echo "══════════════════════════════════════════════"

R=$(payme "UnknownMethod" "{}" 16)
check_error "Неизвестный метод → METHOD_NOT_FOUND (-32601)" "$R" "-32601"

echo ""
echo "══════════════════════════════════════════════"
echo " ИТОГ: Проверяем БД"
echo "══════════════════════════════════════════════"
docker exec contador-admin node -e "
const { PrismaClient } = require('/app/v2/node_modules/.prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://user:password@db:5432/contador_v2' } } });
async function main() {
  const [p1, p2, sub] = await Promise.all([
    prisma.payment.findUnique({ where: { id: '$PAY1' } }),
    prisma.payment.findUnique({ where: { id: '$PAY2' } }),
    prisma.subscription.findUnique({ where: { orgId: '788b95f2-2130-4b59-bf92-c9111318c763' } })
  ]);
  console.log('Платёж 1 (success):', p1?.status, '| completedAt:', p1?.completedAt ? 'yes' : 'no');
  console.log('Платёж 2 (cancel): ', p2?.status, '| cancelReason:', p2?.cancelReason);
  console.log('Подписка org:      ', sub?.plan, '| validUntil:', sub?.validUntil?.toISOString()?.slice(0,10));
}
main().catch(console.error).finally(() => prisma.\$disconnect());
" 2>/dev/null

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Конфигурация для кабинета Payme             ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  URL:   https://contador.uz/admin/api/v2/payments/payme"
echo "║  Login: Paycom                               ║"
echo "║  Key:   (payme_test_key из БД paymentConfig) ║"
echo "║  Поле:  order_id (тип: string)               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
