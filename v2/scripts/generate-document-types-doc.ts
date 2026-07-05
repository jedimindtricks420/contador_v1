/**
 * Generates docs/DOCUMENT_TYPES.md directly from ensureBaseData.ts's
 * baseDocumentTypes array. This file must never be hand-edited — it is
 * regenerated (`npm run docs:types`) whenever a document type changes, so it
 * can't physically go stale the way the old hand-maintained version did.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { baseDocumentTypes } from "../src/lib/ensureBaseData";

interface TemplateLine {
  accountCode: string;
  side: string;
  expression: string;
  condition?: string;
  subcontoType?: string;
}

function renderLine(line: TemplateLine): string {
  const side = line.side === "debit" ? "Дт" : "Кт";
  const parts = [`${side} \`${line.accountCode}\` = \`${line.expression}\``];
  if (line.condition) parts.push(`при условии \`${line.condition}\``);
  if (line.subcontoType) parts.push(`субконто: ${line.subcontoType}`);
  return parts.join(" — ");
}

function renderDocType(dt: { code: string; name: string; mode: string; template: any }): string {
  const lines = dt.template.lines.map((l: TemplateLine) => `  - ${renderLine(l)}`).join("\n") || "  _(нет строк проводки)_";

  const flags: string[] = [];
  if (dt.template.opensItem) flags.push(`открывает Open Item на \`${dt.template.itemAccountCode}\``);
  if (dt.template.closesOpenItemByAccount) flags.push(`закрывает Open Item на \`${dt.template.closesOpenItemByAccount}\``);
  flags.push(dt.template.requiresCounterparty ? "требует контрагента" : "контрагент не обязателен");

  return [
    `### \`${dt.code}\``,
    "",
    `**${dt.name}**`,
    "",
    `- Режим: \`${dt.mode}\``,
    `- ${flags.join("; ")}`,
    "",
    "Проводки:",
    lines,
    "",
  ].join("\n");
}

function generate(): string {
  const byMode: Record<string, typeof baseDocumentTypes> = {};
  for (const dt of baseDocumentTypes) {
    (byMode[dt.mode] ??= []).push(dt);
  }

  const modeOrder = ["BANK_AUTO", "HYBRID", "MANUAL_ONLY"];
  const modeLabels: Record<string, string> = {
    BANK_AUTO: "Автоматически по банковской выписке",
    HYBRID: "Гибридный (банк + ручной ввод)",
    MANUAL_ONLY: "Только ручной ввод",
  };

  const sections = modeOrder
    .filter((mode) => byMode[mode]?.length)
    .map((mode) => {
      const docs = [...byMode[mode]].sort((a, b) => a.code.localeCompare(b.code));
      return [
        `## ${modeLabels[mode] ?? mode} (${docs.length})`,
        "",
        ...docs.map(renderDocType),
      ].join("\n");
    });

  const header = [
    "# Типы документов Contador v2",
    "",
    "> Автогенерируется из `src/lib/ensureBaseData.ts` (`baseDocumentTypes`).",
    "> **Не редактировать вручную** — правки будут потеряны при следующем запуске `npm run docs:types`.",
    "> Регенерировать: `npm run docs:types`.",
    "",
    `Всего типов документов: **${baseDocumentTypes.length}**.`,
    "",
  ].join("\n");

  return `${header}\n${sections.join("\n")}\n`;
}

const outPath = join(__dirname, "..", "docs", "DOCUMENT_TYPES.md");
writeFileSync(outPath, generate());
console.log(`[docs:types] Сгенерирован ${outPath} — ${baseDocumentTypes.length} типов документов.`);
