import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const requirePackage = createRequire(import.meta.url);
const configEntry = requirePackage.resolve("@prisma/config");
const requireConfigDependency = createRequire(configEntry);

describe("Prisma config security override compatibility", () => {
  it("loads a real project config with the overridden merger", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "contador-prisma-config-"));
    try {
      await writeFile(path.join(directory, "prisma.config.cjs"),
        `module.exports = require(${JSON.stringify(configEntry)}).defineConfig({ schema: "prisma/schema.prisma", engine: "classic", datasource: { url: "postgresql://invalid:invalid@127.0.0.1:9/unavailable" } });`,
      );
      const { loadConfigFromFile } = requirePackage("@prisma/config") as typeof import("@prisma/config");
      const loaded = await loadConfigFromFile({ configRoot: directory });
      expect(loaded.error).toBeUndefined();
      expect(loaded.config?.schema).toBe(path.join(directory, "prisma/schema.prisma"));
      expect(loaded.resolvedPath).toBe(path.join(directory, "prisma.config.cjs"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("merges ordinary config records and handles recursive graphs without stack exhaustion", () => {
    const { deepmerge } = requireConfigDependency("deepmerge-ts");
    expect(deepmerge({ datasource: { url: "synthetic" } }, { migrations: { path: "migrations" } }))
      .toEqual({ datasource: { url: "synthetic" }, migrations: { path: "migrations" } });
    const first: { self?: unknown } = {};
    const second: { self?: unknown } = {};
    first.self = first;
    second.self = second;
    expect(() => deepmerge(first, second)).not.toThrow();
  });
});