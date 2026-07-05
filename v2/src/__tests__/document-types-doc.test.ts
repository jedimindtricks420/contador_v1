/**
 * docs/DOCUMENT_TYPES.md is generated (npm run docs:types), never hand-edited.
 * This regression test just confirms it's actually in sync with the current
 * baseDocumentTypes — catches the case where someone added/renamed a document
 * type and forgot to regenerate before committing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { baseDocumentTypes } from "@/lib/ensureBaseData";

describe("docs/DOCUMENT_TYPES.md stays in sync with baseDocumentTypes", () => {
  const docPath = join(__dirname, "..", "..", "docs", "DOCUMENT_TYPES.md");
  const content = readFileSync(docPath, "utf-8");

  it("mentions every document type code currently defined", () => {
    const missing = baseDocumentTypes
      .map((dt) => dt.code)
      .filter((code) => !content.includes(`\`${code}\``));
    expect(missing).toEqual([]);
  });

  it("declares the same total count as baseDocumentTypes.length", () => {
    const match = content.match(/Всего типов документов: \*\*(\d+)\*\*/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(baseDocumentTypes.length);
  });
});
