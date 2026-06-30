#!/bin/bash
# Тестирование Payme + Click API для contador v2
# Использование:
#   bash test-payments.sh           # локально
#   bash test-payments.sh --prod    # через публичный URL

set -e

LOCAL_URL="http://localhost:3031/admin/api"
PUBLIC_URL="https://contador.uz/admin/api"
BASE_URL="$LOCAL_URL"
[ "$1" = "--prod" ] && BASE_URL="$PUBLIC_URL" && echo "⚠  Публичный URL: $PUBLIC_URL" || echo "ℹ  Локальный URL: $LOCAL_URL"

PAYME_KEY="S9D47XBCDaYAfK58EUozsCe27noMB1NJpz?9"
CLICK_SECRET="tLlt4iqzdR7XBR"
CLICK_SERVICE_ID="106510"
ORG_ID="788b95f2-2130-4b59-bf92-c9111318c763"
AMOUNT=299000
AMOUNT_TIYIN=29900000
SIGN_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
NOW_MS=$(($(date +%s) * 1000))

PASS=0; FAIL=0

ok()  { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ❌ $1"; echo "     $2"; FAIL=$((FAIL+1)); }

check_ok() {
  local label="$1" resp="$2" expect="$3"
  echo "$resp" | grep -q "$expect" && ok "$label" || fail "$label" "$resp"
}
check_err() {
  local label="$1" resp="$2" code="$3"
  echo "$resp" | grep -q "\"code\":$code\|\"error\":$code" && ok "$label (код $code)" || fail "$label" "$resp"
}

payme_req() {
  curl -s -X POST "$BASE_URL/v2/payments/payme" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n "Paycom:${PAYME_KEY}" | base64 -w 0)" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$3,\"method\":\"$1\",\"params\":$2}"
}

click_sign() {
  local action=$1 trans_id=$2 order_code=$3 prepare_id=$4
  if [ "$action" = "0" ]; then
    echo -n "${trans_id}${CLICK_SERVICE_ID}${CLICK_SECRET}${order_code}${AMOUNT}${action}${SIGN_TIME}" | md5sum | cut -d' ' -f1
  else
    echo -n "${trans_id}${CLICK_SERVICE_ID}${CLICK_SECRET}${order_code}${prepare_id}${AMOUNT}${action}${SIGN_TIME}" | md5sum | cut -d' ' -f1
  fi
}

click_prepare() {
  local trans_id=$1 order_code=$2
  local sign=$(click_sign 0 "$trans_id" "$order_code" "")
  curl -s -X POST "$BASE_URL/v2/payments/click/prepare" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "click_trans_id=${trans_id}" \
    --data-urlencode "service_id=${CLICK_SERVICE_ID}" \
    --data-urlencode "merchant_trans_id=${order_code}" \
    --data-urlencode "amount=${AMOUNT}" \
    --data-urlencode "action=0" \
    --data-urlencode "sign_time=${SIGN_TIME}" \
    --data-urlencode "sign_string=${sign}"
}

click_complete() {
  local trans_id=$1 order_code=$2
  local sign=$(click_sign 1 "$trans_id" "$order_code" "$order_code")
  curl -s -X POST "$BASE_URL/v2/payments/click/complete" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "click_trans_id=${trans_id}" \
    --data-urlencode "service_id=${CLICK_SERVICE_ID}" \
    --data-urlencode "merchant_trans_id=${order_code}" \
    --data-urlencode "merchant_prepare_id=${order_code}" \
    --data-urlencode "amount=${AMOUNT}" \
    --data-urlencode "action=1" \
    --data-urlencode "error=0" \
    --data-urlencode "sign_time=${SIGN_TIME}" \
    --data-urlencode "sign_string=${sign}"
}

# ─── Создаём тестовые платежи ─────────────────────────────────────────────────
echo ""
echo "📦 Создаём тестовые заказы..."

create_payment() {
  local provider=$1
  curl -s -X POST "$BASE_URL/v2/payments/initiate" \
    -H "Content-Type: application/json" \
    -d "{\"orgId\":\"${ORG_ID}\",\"provider\":\"${provider}\"}"
}

R=$(create_payment CLICK); CLICK_CODE=$(echo "$R" | grep -o '"paymentId":"[^"]*"' | cut -d'"' -f4)
R=$(create_payment CLICK); CLICK_CODE2=$(echo "$R" | grep -o '"paymentId":"[^"]*"' | cut -d'"' -f4)
R=$(create_payment PAYME); PAYME_CODE=$(echo "$R" | grep -o '"paymentId":"[^"]*"' | cut -d'"' -f4)
R=$(create_payment PAYME); PAYME_CODE2=$(echo "$R" | grep -o '"paymentId":"[^"]*"' | cut -d'"' -f4)

echo "  Click заказ 1:  $CLICK_CODE"
echo "  Click заказ 2:  $CLICK_CODE2"
echo "  Payme заказ 1:  $PAYME_CODE"
echo "  Payme заказ 2:  $PAYME_CODE2"

[ ${#CLICK_CODE} -eq 5 ] && ok "Click order_code — 5 цифр" || fail "Click order_code — 5 цифр" "$CLICK_CODE"
[ ${#PAYME_CODE} -eq 5 ] && ok "Payme order_code — 5 цифр" || fail "Payme order_code — 5 цифр" "$PAYME_CODE"

PAYME_TRANS="payme-cnt-test-$(date +%s)"
PAYME_TRANS2="payme-cnt-cancel-$(date +%s)"

# ══════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
echo " CLICK — Prepare / Complete"
echo "══════════════════════════════════════════════════════"

R=$(click_prepare 10001 "$CLICK_CODE")
check_ok "Prepare → merchant_prepare_id = order_code" "$R" "\"merchant_prepare_id\":\"${CLICK_CODE}\""
check_ok "Prepare → error:0" "$R" '"error":0'

R=$(click_prepare 10001 "$CLICK_CODE")
check_ok "Prepare повторный (идемпотентность) → error:0" "$R" '"error":0'

R=$(click_complete 10001 "$CLICK_CODE")
check_ok "Complete → merchant_confirm_id = order_code" "$R" "\"merchant_confirm_id\":\"${CLICK_CODE}\""
check_ok "Complete → error:0" "$R" '"error":0'

R=$(click_complete 10001 "$CLICK_CODE")
check_ok "Complete повторный (уже SUCCESS) → error:0" "$R" '"error":0'

echo ""
echo "── Click — ошибки ──"
WRONG_SIGN=$(click_sign 0 "99999" "00000" "")
R=$(curl -s -X POST "$BASE_URL/v2/payments/click/prepare" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "click_trans_id=99999" --data-urlencode "service_id=${CLICK_SERVICE_ID}" \
  --data-urlencode "merchant_trans_id=00000" --data-urlencode "amount=${AMOUNT}" \
  --data-urlencode "action=0" --data-urlencode "sign_time=${SIGN_TIME}" \
  --data-urlencode "sign_string=wrongsign")
check_err "Неверная подпись → -1" "$R" "-1"

SIGN_MISSING=$(click_sign 0 "10002" "00000" "")
R=$(curl -s -X POST "$BASE_URL/v2/payments/click/prepare" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "click_trans_id=10002" --data-urlencode "service_id=${CLICK_SERVICE_ID}" \
  --data-urlencode "merchant_trans_id=00000" --data-urlencode "amount=${AMOUNT}" \
  --data-urlencode "action=0" --data-urlencode "sign_time=${SIGN_TIME}" \
  --data-urlencode "sign_string=${SIGN_MISSING}")
check_err "Несуществующий заказ → -5" "$R" "-5"

SIGN_AMT=$(node -e "const c=require('crypto');console.log(c.createHash('md5').update('10003${CLICK_SERVICE_ID}${CLICK_SECRET}${CLICK_CODE2}100' + '0' + '${SIGN_TIME}').digest('hex'))")
R=$(curl -s -X POST "$BASE_URL/v2/payments/click/prepare" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "click_trans_id=10003" --data-urlencode "service_id=${CLICK_SERVICE_ID}" \
  --data-urlencode "merchant_trans_id=${CLICK_CODE2}" --data-urlencode "amount=100" \
  --data-urlencode "action=0" --data-urlencode "sign_time=${SIGN_TIME}" \
  --data-urlencode "sign_string=${SIGN_AMT}")
check_err "Неверная сумма → -2" "$R" "-2"

# ══════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
echo " PAYME — все 6 методов"
echo "══════════════════════════════════════════════════════"

echo ""
echo "── Авторизация ──"
R=$(curl -s -X POST "$BASE_URL/v2/payments/payme" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'Paycom:wrong' | base64 -w 0)" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"CheckPerformTransaction\",\"params\":{\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"${PAYME_CODE}\"}}}")
check_err "Неверный ключ → -32504" "$R" "-32504"

echo ""
echo "── CheckPerformTransaction ──"
R=$(payme_req "CheckPerformTransaction" "{\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"${PAYME_CODE}\"}}" 10)
check_ok "Корректный заказ → allow:true" "$R" '"allow":true'

R=$(payme_req "CheckPerformTransaction" "{\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"00000\"}}" 11)
check_err "Несуществующий → -31050" "$R" "-31050"

R=$(payme_req "CheckPerformTransaction" "{\"amount\":999,\"account\":{\"order_id\":\"${PAYME_CODE}\"}}" 12)
check_err "Неверная сумма → -31001" "$R" "-31001"

echo ""
echo "── CreateTransaction ──"
R=$(payme_req "CreateTransaction" "{\"id\":\"${PAYME_TRANS}\",\"time\":${NOW_MS},\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"${PAYME_CODE}\"}}" 20)
check_ok "Создание → state:1" "$R" '"state":1'
check_ok "transaction = order_code (5 цифр)" "$R" "\"transaction\":\"${PAYME_CODE}\""

R=$(payme_req "CreateTransaction" "{\"id\":\"${PAYME_TRANS}\",\"time\":${NOW_MS},\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"${PAYME_CODE}\"}}" 21)
check_ok "Повторный (идемпотентность) → state:1" "$R" '"state":1'

echo ""
echo "── PerformTransaction ──"
R=$(payme_req "PerformTransaction" "{\"id\":\"${PAYME_TRANS}\"}" 30)
check_ok "Выполнение → state:2" "$R" '"state":2'
check_ok "transaction = order_code" "$R" "\"transaction\":\"${PAYME_CODE}\""

R=$(payme_req "PerformTransaction" "{\"id\":\"${PAYME_TRANS}\"}" 31)
check_ok "Повторный (идемпотентность) → state:2" "$R" '"state":2'

echo ""
echo "── CheckTransaction ──"
R=$(payme_req "CheckTransaction" "{\"id\":\"${PAYME_TRANS}\"}" 40)
check_ok "После оплаты → state:2" "$R" '"state":2'
check_ok "perform_time > 0" "$R" '"perform_time":[1-9]'

R=$(payme_req "CheckTransaction" "{\"id\":\"несуществующий\"}" 41)
check_err "Несуществующая транзакция → -31003" "$R" "-31003"

echo ""
echo "── CheckPerformTransaction после оплаты ──"
R=$(payme_req "CheckPerformTransaction" "{\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"${PAYME_CODE}\"}}" 42)
check_err "Уже оплачен → -31052" "$R" "-31052"

echo ""
echo "── CancelTransaction ──"
R=$(payme_req "CreateTransaction" "{\"id\":\"${PAYME_TRANS2}\",\"time\":${NOW_MS},\"amount\":${AMOUNT_TIYIN},\"account\":{\"order_id\":\"${PAYME_CODE2}\"}}" 50)
check_ok "Create для отмены → state:1" "$R" '"state":1'

R=$(payme_req "CancelTransaction" "{\"id\":\"${PAYME_TRANS2}\",\"reason\":5}" 51)
check_ok "Отмена → state:-1" "$R" '"state":-1'
check_ok "transaction = order_code" "$R" "\"transaction\":\"${PAYME_CODE2}\""

R=$(payme_req "CancelTransaction" "{\"id\":\"${PAYME_TRANS2}\",\"reason\":5}" 52)
check_ok "Повторная отмена (идемпотентность) → state:-1" "$R" '"state":-1'

echo ""
echo "── GetStatement ──"
FROM=$((NOW_MS - 3600000)); TO=$((NOW_MS + 3600000))
R=$(payme_req "GetStatement" "{\"from\":${FROM},\"to\":${TO}}" 60)
check_ok "GetStatement → список транзакций" "$R" '"transactions"'
check_ok "account.order_id — 5 цифр" "$R" '"order_id":"[0-9][0-9][0-9][0-9][0-9]"'

echo ""
echo "── Неизвестный метод ──"
R=$(payme_req "UnknownMethod" "{}" 70)
check_err "Метод не найден → -32601" "$R" "-32601"

# ══════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
echo " БД — проверка результатов"
echo "══════════════════════════════════════════════════════"
docker exec contador-admin node -e "
const { PrismaClient } = require('/app/v2/node_modules/.prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://user:password@319b5e2913a4_contador-db:5432/contador_v2' } } });
async function main() {
  const [p1, p2, p3, p4] = await Promise.all([
    prisma.payment.findUnique({ where: { orderCode: '${CLICK_CODE}' } }),
    prisma.payment.findUnique({ where: { orderCode: '${CLICK_CODE2}' } }),
    prisma.payment.findUnique({ where: { orderCode: '${PAYME_CODE}' } }),
    prisma.payment.findUnique({ where: { orderCode: '${PAYME_CODE2}' } }),
  ]);
  console.log('Click  ' + '${CLICK_CODE}' + ': ' + p1?.status);
  console.log('Click  ' + '${CLICK_CODE2}' + ': ' + p2?.status + ' (не оплачен — ожидается PENDING)');
  console.log('Payme  ' + '${PAYME_CODE}' + ': ' + p3?.status);
  console.log('Payme  ' + '${PAYME_CODE2}' + ': ' + p4?.status + ' (отменён — ожидается FAILED)');
}
main().catch(console.error).finally(() => prisma.\$disconnect());
" 2>/dev/null

echo ""
echo "══════════════════════════════════════════════════════"
echo " ИТОГ: ✅ $PASS  ❌ $FAIL"
echo "══════════════════════════════════════════════════════"
[ $FAIL -eq 0 ] && exit 0 || exit 1
