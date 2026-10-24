import { posix } from "node:path";

const LIST_LINK = /^\s*-\s.*\]\(([^)]+\.md)\)/;

// Recorder rebuilds INDEX.md only on next finalize. Until then, drop rows whose entry moved away.
export function filterIndexLinks(
  markdown: string,
  indexPath: string,
  existingPaths: ReadonlySet<string>,
): string {
  const directory = posix.dirname(indexPath);

  return markdown
    .split("\n")
    .filter((line) => {
      const target = line.match(LIST_LINK)?.[1];
      if (!target || /^[a-z]+:/i.test(target)) return true;
      try {
        return existingPaths.has(posix.normalize(posix.join(directory, decodeURI(target))));
      } catch {
        return true;
      }
    })
    .join("\n");
}
