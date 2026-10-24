import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it("reads external journal root without changing source", async () => {
  const root = await mkdtemp(join(tmpdir(), "ledger private "));
  const setup = resolve(import.meta.dirname, "../..");
  const source = "# External private decision\n\nKeep source bytes.\n";
  try {
    await mkdir(join(root, "example"));
    await writeFile(join(root, "example", "2026-01-01_10-00_external.md"), source);
    execFileSync(process.execPath, ["--import", "tsx", "scripts/generate-content.ts"], {
      cwd: setup,
      env: { ...process.env, JOURNAL_ROOT: root },
      stdio: "pipe",
    });
    const manifest = JSON.parse(await readFile(join(setup, ".generated/content/journal-manifest.json"), "utf8"));
    expect(manifest.entries.map((entry: { sourcePath: string }) => entry.sourcePath)).toEqual([
      "example/2026-01-01_10-00_external.md",
    ]);
    expect(await readFile(join(root, "example", "2026-01-01_10-00_external.md"), "utf8")).toBe(source);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
