import { expect, it } from "vitest";

import { archivePathFor, validateEntryPath } from "../../src/archive/path";

it.each([
  "example/2026-10-23_10-15_customer-queue-async-export.md",
  "Mixed-Case-Project/commits/2026-08-03_12-58_drop-forwarder.md",
  "Example.github.io/2026-07-01_09-00_site.md",
])("accepts dated session and commit journal %s", (path) => {
  expect(validateEntryPath(path)).toBe(path);
});

it.each([
  "HOME.md",
  "example/INDEX.md",
  "AGENTS.md",
  ".archive/example/2026-10-23_x.md",
  "../example/2026-10-23_x.md",
  "example/../2026-10-23_x.md",
  "example/./2026-10-23_x.md",
  "/example/2026-10-23_x.md",
  "example/notes/2026-10-23_x.md",
  "example/2026-10-23_x.txt",
  "docs/2026-09-12-web-entry-archive-design.md",
  "src/2026-01-01_x.md",
  "example/2026-10-23_x.md/",
  "",
  42,
  undefined,
])("rejects protected or malformed path %s", (path) => {
  expect(validateEntryPath(path)).toBeUndefined();
});

it("keeps original layout under the archive root", () => {
  expect(archivePathFor("example/commits/2026-10-23_x.md")).toBe(
    ".archive/example/commits/2026-10-23_x.md",
  );
});
