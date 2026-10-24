import { readdir } from "node:fs/promises";
import { join, posix } from "node:path";

import { WEBSITE_DIRECTORIES } from "./website-directories";

export async function discoverJournalFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string, relativeDirectory = ""): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const relativePath = relativeDirectory
        ? posix.join(relativeDirectory, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        if (!relativeDirectory && WEBSITE_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await walk(join(directory, entry.name), relativePath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        (relativeDirectory || entry.name === "HOME.md")
      ) {
        files.push(relativePath);
      }
    }
  }

  await walk(root);

  return files.sort();
}
