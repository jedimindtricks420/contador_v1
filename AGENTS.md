<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Учёт: не доверяй голым названиям счетов — проверяй свои же документы проекта

`ensureBaseData.ts` (шаблоны проводок), `constants.ts` (коды счетов) и Форма №1/№2
(`v2/src/app/api/reports/balance/route.ts`, `v2/src/app/api/pnl/route.ts`) — это единая
система: изменение одного счёта в шаблоне проводки меняет, в какую строку отчёта
попадёт операция. НСБУ-21 план счетов (`nsbu_and_soliq_codex/`) даёт только буквальное
название счёта — этого **недостаточно**, чтобы понять, что означает конкретная
строка Формы №1/№2 в ЭТОМ проекте (пример: 05.07.2026 счёт 9810 был ошибочно
переоценён как "только налог на прибыль" по буквальному имени счёта, хотя по всей
архитектурной документации проекта строка 250 Формы №2 — общая для обоих налоговых
режимов и всегда идёт через 9810; см. `v2/docs/modules/Contador_CHANGELOG_FULL_v3.md`,
разделы П1.2/П2.2/Н9). Перед тем как менять код счёта в существующем шаблоне
проводки — сверься с README.md, `docs/contador_accounting_engine_spec.md`,
`v2/docs/modules/module_G_reports.md`, `module_H_posting_engine.md`, а не только
с планом счетов.

**Правило процесса:** при изменении шаблона проводки (`ensureBaseData.ts`) или кода
счёта, добавлении/переименовании типа документа — обновлять в том же PR:
1. `docs/DOCUMENT_TYPES.md` — командой `npm run docs:types` (проверяется тестом
   `document-types-doc.test.ts`, падает при рассинхронизации);
2. `PNL_COVERED_TRANSIT_CODES`/`PNL_UNUSED_TRANSIT_CODES` в `pnl/route.ts` и
   `BALANCE_PASSIVE_CODES`/`BALANCE_NON_CASH_ASSET_CODES` в `balance/route.ts`, если
   меняется счёт, участвующий в Форме №1/№2 (проверяется тестами
   `pnl-transit-completeness.test.ts` и `balance-sheet-*-completeness.test.ts`);
3. Затронутые разделы README.md / `docs/contador_accounting_engine_spec.md` /
   `module_G_reports.md` / `module_H_posting_engine.md`, если меняется поведение,
   а не только текст.
