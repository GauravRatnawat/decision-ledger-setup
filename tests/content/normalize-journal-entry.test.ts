import { describe, expect, it } from "vitest";

import { normalizeJournalEntry } from "../../src/content/normalize-journal-entry";

describe("normalizeJournalEntry", () => {
  it("prefers the frontmatter title", () => {
    const entry = normalizeJournalEntry({
      markdown: `---
title: Explicit decision title
---

# Heading fallback
`,
      sourcePath: "example/2026-07-31_10-50_heading-fallback.md",
    });

    expect(entry.title).toBe("Explicit decision title");
  });

  it("uses the first heading when frontmatter has no title", () => {
    const entry = normalizeJournalEntry({
      markdown: "# Heading fallback\n\nDecision evidence.",
      sourcePath: "example/2026-07-31_10-50_filename-fallback.md",
    });

    expect(entry.title).toBe("Heading fallback");
  });

  it("turns the filename into a title when the document has none", () => {
    const entry = normalizeJournalEntry({
      markdown: "Decision evidence without a heading.",
      sourcePath: "example/2026-07-31_10-50_filename-fallback.md",
    });

    expect(entry.title).toBe("Filename fallback");
  });

  it("derives a stable commit route from the source path", () => {
    const entry = normalizeJournalEntry({
      markdown: "# Enforce authentication",
      sourcePath: "example/commits/2026-07-31_10-50_enforce-authentication.md",
    });

    expect(entry).toMatchObject({
      project: "example",
      route: "/projects/example/commits/d-2026-07-31_10-50_enforce-authentication",
      type: "commit",
    });
  });

  it("preserves journal metadata for Blume", () => {
    const entry = normalizeJournalEntry({
      markdown: `---
title: Authentication decision
project: example
date: 2026-07-31T10:50:00+02:00
session_id: session-42
source: codex
model: gpt-5
tags: [security, decision]
---
`,
      sourcePath: "example/2026-07-31_10-50_authentication-decision.md",
    });

    expect(entry.metadata).toEqual({
      date: "2026-07-31T10:50:00+02:00",
      model: "gpt-5",
      sessionId: "session-42",
      source: "codex",
      tags: ["security", "decision"],
    });
  });

  it("rewrites Obsidian project links in the rendered body", () => {
    const entry = normalizeJournalEntry({
      markdown: `---
title: Authentication decision
---

Evidence stays readable.

**Project:** [[example/INDEX|example]]
`,
      sourcePath: "example/2026-07-31_10-50_authentication-decision.md",
    });

    expect(entry.body).toBe(
      "Evidence stays readable.\n\n**Project:** [example](/projects/example)",
    );
  });

  it("maps primary journal paths to their public routes", () => {
    const session = normalizeJournalEntry({
      markdown: "# Session",
      sourcePath: "example/2026-07-31_10-50_session.md",
    });
    const projectIndex = normalizeJournalEntry({
      markdown: "# ACM",
      sourcePath: "example/INDEX.md",
    });
    const home = normalizeJournalEntry({
      markdown: "# Journal",
      sourcePath: "HOME.md",
    });

    expect([
      { route: session.route, type: session.type },
      { route: projectIndex.route, type: projectIndex.type },
      { route: home.route, type: home.type },
    ]).toEqual([
      {
        route: "/projects/example/d-2026-07-31_10-50_session",
        type: "session",
      },
      { route: "/source/projects/example", type: "project-index" },
      { route: "/source/home", type: "home" },
    ]);
  });
});
