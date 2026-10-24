import { WEBSITE_DIRECTORIES } from "../content/website-directories";

const ENTRY_PATH =
  /^[A-Za-z0-9][\w.-]*\/(commits\/)?\d{4}-\d{2}-\d{2}[\w.-]*\.md$/;

export const ARCHIVE_ROOT = ".archive";

// Gate for every archive and restore. Only dated session and commit journals pass.
export function validateEntryPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !ENTRY_PATH.test(value)) return undefined;
  const segments = value.split("/");
  if (WEBSITE_DIRECTORIES.has(segments[0])) return undefined;
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    return undefined;
  }
  return value;
}

export function archivePathFor(sourcePath: string): string {
  return `${ARCHIVE_ROOT}/${sourcePath}`;
}
