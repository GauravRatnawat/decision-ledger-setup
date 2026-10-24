import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import matter from "gray-matter";
import { afterEach, expect, it } from "vitest";

import { generateJournalContent } from "../../src/content/generate-journal-content";

let fixtureRoot: string | undefined;

afterEach(async () => {
  if (fixtureRoot) {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});

it("writes a Blume page without changing its source journal", async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "decision-ledger-generate-"));
  const outputRoot = join(fixtureRoot, ".generated", "content");
  const sourcePath = join(fixtureRoot, "example", "session.md");
  const source = "# Authentication decision\n\nEvidence stays intact.\n";
  await mkdir(join(fixtureRoot, "example"), { recursive: true });
  await writeFile(sourcePath, source);

  await generateJournalContent({ outputRoot, root: fixtureRoot });

  const generated = matter(
    await readFile(join(outputRoot, "projects", "example", "session.md"), "utf8"),
  );
  expect({
    body: generated.content.trim(),
    source: await readFile(sourcePath, "utf8"),
    title: generated.data.title,
    type: generated.data.type,
  }).toEqual({
    body: "Evidence stays intact.",
    source,
    title: "Authentication decision",
    type: "session",
  });
});

it("writes a journal manifest for custom Blume pages", async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "decision-ledger-manifest-"));
  const outputRoot = join(fixtureRoot, ".generated", "content");
  await mkdir(join(fixtureRoot, "example", "commits"), { recursive: true });
  await writeFile(
    join(fixtureRoot, "example", "2026-07-31_10-50_session.md"),
    "# Authentication decision",
  );
  await writeFile(
    join(fixtureRoot, "example", "commits", "2026-07-31_11-00_change.md"),
    "# Authentication change",
  );

  await generateJournalContent({ outputRoot, root: fixtureRoot });

  const manifest = JSON.parse(
    await readFile(join(outputRoot, "journal-manifest.json"), "utf8"),
  );
  expect(manifest.entries).toEqual([
    expect.objectContaining({
      project: "example",
      route: "/projects/example/d-2026-07-31_10-50_session",
      title: "Authentication decision",
      type: "session",
    }),
    expect.objectContaining({
      project: "example",
      route: "/projects/example/commits/d-2026-07-31_11-00_change",
      title: "Authentication change",
      type: "commit",
    }),
  ]);
});

it("lists archived entries by metadata only and keeps their bodies off the site", async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "decision-ledger-archive-"));
  const outputRoot = join(fixtureRoot, ".generated", "content");
  await mkdir(join(fixtureRoot, "example"), { recursive: true });
  await mkdir(join(fixtureRoot, ".archive", "example", "commits"), { recursive: true });
  await writeFile(join(fixtureRoot, "example", "2026-07-31_10-50_kept.md"), "# Kept decision");
  await writeFile(
    join(fixtureRoot, ".archive", "example", "2026-07-30_09-00_gone.md"),
    "---\ntitle: Gone decision\ndate: 2026-07-30T09:00:00+02:00\n---\n\nSecret archived body.\n",
  );
  await writeFile(
    join(fixtureRoot, ".archive", "example", "commits", "2026-07-29_08-00_old.md"),
    "# Old change",
  );

  await generateJournalContent({ outputRoot, root: fixtureRoot });

  const manifestText = await readFile(join(outputRoot, "journal-manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  expect(manifest.archives).toEqual([
    {
      date: "2026-07-30T09:00:00+02:00",
      project: "example",
      sourcePath: "example/2026-07-30_09-00_gone.md",
      title: "Gone decision",
      type: "session",
    },
    {
      date: "2026-07-29T08:00:00",
      project: "example",
      sourcePath: "example/commits/2026-07-29_08-00_old.md",
      title: "Old change",
      type: "commit",
    },
  ]);
  expect(manifest.entries.map((entry: { sourcePath: string }) => entry.sourcePath)).toEqual([
    "example/2026-07-31_10-50_kept.md",
  ]);
  expect(manifestText).not.toContain("Secret archived body");
});

it("drops project index rows whose entry was archived without changing the source index", async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "decision-ledger-index-"));
  const outputRoot = join(fixtureRoot, ".generated", "content");
  const index = [
    "# Journal Index — example",
    "",
    "- 2026-07-31 10:50 — [Kept](2026-07-31_10-50_kept.md) — #a",
    "- 2026-07-30 09:00 — [Gone](2026-07-30_09-00_gone.md) — #b",
    "- External [docs](https://example.com/guide.md)",
    "",
  ].join("\n");
  await mkdir(join(fixtureRoot, "example"), { recursive: true });
  await writeFile(join(fixtureRoot, "example", "2026-07-31_10-50_kept.md"), "# Kept");
  await writeFile(join(fixtureRoot, "example", "INDEX.md"), index);

  await generateJournalContent({ outputRoot, root: fixtureRoot });

  const page = await readFile(join(outputRoot, "source", "projects", "example", "index.md"), "utf8");
  expect(page).toContain("[Kept](2026-07-31_10-50_kept.md)");
  expect(page).not.toContain("Gone");
  expect(page).toContain("https://example.com/guide.md");
  expect(await readFile(join(fixtureRoot, "example", "INDEX.md"), "utf8")).toBe(index);
});
