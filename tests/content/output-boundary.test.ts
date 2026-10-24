import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { generateJournalContent } from "../../src/content/generate-journal-content";

it("rejects project metadata that escapes generated output", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "ledger-boundary-"));
  try {
    const root = join(fixture, "journals");
    const setup = join(fixture, "setup");
    await mkdir(join(root, "example"), { recursive: true });
    await mkdir(join(setup, "public"), { recursive: true });
    const leaked = join(setup, "public", "d-2026-01-01_secret.md");
    const markdown = "---\nproject: ../../../public\n---\n# Fake secret\n\nDo not leak.\n";
    await writeFile(join(root, "example", "2026-01-01_secret.md"), markdown);
    await expect(generateJournalContent({ root, outputRoot: join(setup, ".generated/content") })).rejects.toThrow(/project|output/i);
    await expect(readFile(leaked, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
