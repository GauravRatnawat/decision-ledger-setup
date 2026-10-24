import { resolve } from "node:path";

import { generateJournalContent } from "../src/content/generate-journal-content";

const setupRoot = resolve(import.meta.dirname, "..");
const root = resolve(process.env.JOURNAL_ROOT ?? resolve(setupRoot, "examples/journals"));
const manifest = await generateJournalContent({
  outputRoot: resolve(setupRoot, ".generated/content"),
  root,
});

console.log(
  `Generated ${manifest.entries.length} journal pages across ${manifest.projects.length} projects.`,
);
