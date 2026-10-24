// Site source folders at repo root. Never journals. Shared with archive path gate, so no node imports here.
export const WEBSITE_DIRECTORIES: ReadonlySet<string> = new Set([
  "coverage",
  "dist",
  "docs",
  "functions",
  "node_modules",
  "pages",
  "public",
  "src",
  "tests",
]);
