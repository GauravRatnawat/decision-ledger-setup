import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { discoverJournalFiles } from "../../src/content/discover-journal-files";

let fixtureRoot: string | undefined;

afterEach(async () => {
  if (fixtureRoot) {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});

it("discovers journal Markdown without indexing website files", async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "decision-ledger-"));
  await mkdir(join(fixtureRoot, "example", "commits"), { recursive: true });
  await mkdir(join(fixtureRoot, "docs"), { recursive: true });
  await mkdir(join(fixtureRoot, ".obsidian"), { recursive: true });
  await writeFile(join(fixtureRoot, "HOME.md"), "# Home");
  await writeFile(join(fixtureRoot, "example", "session.md"), "# Session");
  await writeFile(join(fixtureRoot, "example", "commits", "change.md"), "# Change");
  await writeFile(join(fixtureRoot, "docs", "index.md"), "# Website");
  await writeFile(join(fixtureRoot, ".obsidian", "note.md"), "# Internal");

  await expect(discoverJournalFiles(fixtureRoot)).resolves.toEqual([
    "HOME.md",
    "example/commits/change.md",
    "example/session.md",
  ]);
});
