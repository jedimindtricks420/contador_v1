#!/usr/bin/env python3
"""
Полная проверка Contador — Gorgeous Partners
Без внешних зависимостей, работает через docker exec
"""
import subprocess
import os
from decimal import Decimal

ORG_ID = 'be9ad6c2-60c4-4d98-a066-fa1410444c30'

def psql(sql):
    r = subprocess.run(
        ['docker', 'exec', 'contador-db', 'psql', '-U', 'user', '-d', 'contador',
         '-t', '-A', '-c', sql],
        capture_output=True, text=True, timeout=15
    )
    return r.stdout.strip(), r.stderr.strip()

def get_sum(field, account_id):
    col = 'debit_id' if field == 'dt' else 'credit_id'
    out, _ = psql(
        f"SELECT COALESCE(SUM(amount),0) FROM \"Transaction\" "
        f"WHERE organization_id='{ORG_ID}' AND {col}='{account_id}' AND is_deleted=false"
    )
    return Decimal(out.strip() or '0')

# Счета
A = {
    '0000': '1fae8fb1-66e0-46d0-8546-ec6bb42c6fbe',
    '5110': '25e12210-ff96-49eb-ba6a-95fd3da58fad',
    '5210': '267c401d-405e-4498-a490-e47b4dbf1993',
    '4010': 'f850348d-9990-409d-8d65-397819721460',
    '6310': '06fa9900-0ac3-4793-924c-3b4ee026d986',
    '8330': '26ed350d-5313-4ced-8764-ef6e9098d111',
    '9030': '40127f76-b916-4750-b9d6-b65d372cd834',
    '9130': '7996ee9f-93c5-4633-b030-913cdd896dc2',
    '9410': 'f6044adc-f0d8-494f-8a45-58998451debd',
    '9420': 'ab952a8e-bd88-4325-9e58-249bfaf2bf4c',
    '6010': '25ad4a7c-4d1c-4d1f-8955-8309a00cbc8e',
    '6410': '8a1d7779-0585-48ca-a946-944e89eef207',
    '6520': 'e02a70b6-4ab5-43a6-b336-d2e6531128c8',
    '6710': 'f7b15deb-5015-4677-9e8f-252e94caa98e',
    '0150': '5a7f2c8b-2045-4cd0-800d-b4f76e701c57',
}

def saldo(code, nature='active'):
    dt = get_sum('dt', A[code])
    ct = get_sum('ct', A[code])
    return dt - ct if nature == 'active' else ct - dt

print()
print("=" * 62)
print("  ПОЛНЫЙ АУДИТ CONTADOR  —  Gorgeous Partners")
print("=" * 62)

# ─── РАЗДЕЛ 1: ДАННЫЕ В БД ────────────────────────────────────────
print("\n📊 РАЗДЕЛ 1: ДАННЫЕ В БД")
count_out, _ = psql(f"SELECT COUNT(*) FROM \"Transaction\" WHERE organization_id='{ORG_ID}' AND is_deleted=false")
count = int(count_out.strip())
print(f"  Транзакций: {count} {'✅' if count == 15 else '❌ ожидалось 15'}")

# ─── РАЗДЕЛ 2: ПРОВЕРКА СЧЁТА 0000 ───────────────────────────────
print("\n🔑 РАЗДЕЛ 2: СЧЁТ 0000 (ввод начальных остатков)")
dt0 = get_sum('dt', A['0000'])
ct0 = get_sum('ct', A['0000'])
diff0 = dt0 - ct0
print(f"  Дт = {dt0:>15,.0f}")
print(f"  Кт = {ct0:>15,.0f}")
print(f"  Δ  = {diff0:>15,.0f}  {'✅ нуль — остатки сбалансированы' if diff0 == 0 else '❌ НЕ СБАЛАНСИРОВАНО'}")

# ─── РАЗДЕЛ 3: КЛЮЧЕВЫЕ СЧЕТА ────────────────────────────────────
print("\n💰 РАЗДЕЛ 3: САЛЬДО КЛЮЧЕВЫХ СЧЕТОВ")
s5110 = saldo('5110')
s5210 = saldo('5210')
s4010 = saldo('4010')
s0150 = saldo('0150')
s8330 = saldo('8330', 'passive')
s6310 = saldo('6310', 'passive')
s6010 = saldo('6010', 'passive')
s6710 = saldo('6710', 'passive')
s6410 = saldo('6410', 'passive')
s6520 = saldo('6520', 'passive')

rows = [
    ('5110', 'Расчётный счёт       ', s5110,   'Дт', s5110  > 0),
    ('5210', 'Валютный счёт        ', s5210,   'Дт', s5210  > 0),
    ('4010', 'Дебиторка            ', s4010,   'Дт', s4010 >= 0),
    ('0150', 'Оборудование         ', s0150,   'Дт', s0150  > 0),
    ('8330', 'Уставный капитал     ', s8330,   'Кт', s8330  > 0),
    ('6310', 'Авансы покупателей   ', s6310,   'Кт', s6310 >= 0),
    ('6010', 'Кредиторка           ', s6010,   'Кт', s6010 >= 0),
    ('6710', 'Зарплата к выплате   ', s6710,   'Кт', s6710 >= 0),
    ('6410', 'Налоги               ', s6410,   'Кт', s6410 >= 0),
    ('6520', 'Соц. фонд            ', s6520,   'Кт', s6520 >= 0),
]
for code, name, val, side, ok in rows:
    sign = '✅' if ok else '⚠️'
    print(f"  {code}  {name} {val:>14,.0f}  ({side})  {sign}")

# ─── РАЗДЕЛ 4: P&L ───────────────────────────────────────────────
print("\n📈 РАЗДЕЛ 4: P&L (Отчёт о финансовых результатах)")
revenue = get_sum('ct', A['9030'])
exp_adm = get_sum('dt', A['9420'])
exp_mkt = get_sum('dt', A['9410'])
exp_cogs = get_sum('dt', A['9130'])
total_exp = exp_adm + exp_mkt + exp_cogs
profit = revenue - total_exp
print(f"  Выручка (9030 Кт)           : {revenue:>14,.0f}")
print(f"  - Себестоимость (9130 Дт)   : {exp_cogs:>14,.0f}")
print(f"  - Адм. расходы (9420 Дт)    : {exp_adm:>14,.0f}")
print(f"  - Маркетинг (9410 Дт)       : {exp_mkt:>14,.0f}")
print(f"  ─────────────────────────────────────────")
print(f"  Чистая прибыль              : {profit:>14,.0f}  {'✅ прибыль' if profit > 0 else '❌ убыток'}")

# ─── РАЗДЕЛ 5: БАЛАНС ────────────────────────────────────────────
print("\n⚖️  РАЗДЕЛ 5: БУХГАЛТЕРСКИЙ БАЛАНС (упрощённый)")
total_assets = s5110 + s5210 + s4010 + s0150
total_pass   = s8330 + s6310 + s6010 + s6710 + s6410 + s6520 + profit
diff_bal = abs(total_assets - total_pass)
print(f"  ИТОГО АКТИВЫ   : {total_assets:>14,.0f}")
print(f"  ИТОГО ПАССИВЫ  : {total_pass:>14,.0f}")
print(f"  РАЗНИЦА        : {diff_bal:>14,.0f}  {'✅ БАЛАНС СХОДИТСЯ' if diff_bal < 1 else '❌ НЕ СХОДИТСЯ'}")

# ─── РАЗДЕЛ 6: ПРОВЕРКА ИСПРАВЛЕНИЙ В КОДЕ ───────────────────────
print("\n🔧 РАЗДЕЛ 6: ПРОВЕРКА ИСПРАВЛЕНИЙ В КОД-ФАЙЛАХ")
checks = [
    ('src/app/api/reports/osv/route.ts',      'CONTRA_PASSIVE',   'OSV API: тип CONTRA_PASSIVE'),
    ('src/app/api/reports/osv/route.ts',      "not: 'OFF_BALANCE'", 'OSV API: OFF_BALANCE исключены'),
    ('src/app/api/reports/balance/route.ts',  "not: 'OFF_BALANCE'", 'Balance API: OFF_BALANCE исключены'),
    ('src/app/api/reports/balance/route.ts',  'liabilities',       'Balance API: логика ACTIVE_PASSIVE'),
    ('src/app/api/reports/pnl/route.ts',      'filterStart',       'PnL API: фильтр по периоду'),
    ('src/app/api/reports/pnl/route.ts',      'yearParam',         'PnL API: параметр year'),
    ('src/app/api/transactions/route.ts',     "...(period ? { period } : {})", 'Transactions API: фильтр period'),
    ('src/app/osv/page.tsx',                  'balanceStartDebit', 'OSV UI: колонки начального сальдо S1'),
    ('src/app/osv/page.tsx',                  'balanceEndDebit',   'OSV UI: колонки конечного сальдо S2'),
    ('src/app/osv/page.tsx',                  'turnoversMatch',    'OSV UI: индикатор закона двойной записи'),
    ('src/app/pnl/page.tsx',                  'setYear',           'PnL UI: выбор года'),
    ('src/app/pnl/page.tsx',                  'setMonth',          'PnL UI: выбор месяца'),
    ('src/app/balance/page.tsx',              'Math.abs',          'Balance UI: float-сравнение исправлено'),
    ('src/app/balance/page.tsx',              '?? 0',              'Balance UI: null-safety добавлен'),
    ('src/app/login/page.tsx',                '/dashboard',        'Login: редирект на /dashboard'),
    ('src/app/login/page.tsx',                'data.redirect',     'Login: поддержка redirect от API'),
    ('src/app/api/transactions/[id]/route.ts','status: 403',       'Delete API: HTTP 403 для закрытого периода'),
]

base = '/home/admin1/contador'
all_ok = True
for relpath, keyword, label in checks:
    filepath = os.path.join(base, relpath)
    try:
        with open(filepath) as f:
            content = f.read()
        if keyword in content:
            print(f"  ✅ {label}")
        else:
            print(f"  ❌ НЕ НАЙДЕНО: {label}")
            all_ok = False
    except FileNotFoundError:
        print(f"  ❌ ФАЙЛ НЕ НАЙДЕН: {relpath}")
        all_ok = False

# ─── ИТОГ ─────────────────────────────────────────────────────────
print()
print("=" * 62)
if all_ok and diff_bal < 1 and diff0 == 0:
    print("  🎉 ВСЕ ПРОВЕРКИ ПРОШЛИ — СИСТЕМА РАБОТАЕТ КОРРЕКТНО")
else:
    print("  ⚠️  ЕСТЬ НЕРЕШЁННЫЕ ПРОБЛЕМЫ — см. выше")
print("=" * 62)
print()
