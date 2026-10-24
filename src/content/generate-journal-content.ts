import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import matter from "gray-matter";

import { ARCHIVE_ROOT } from "../archive/path";
import { discoverJournalFiles } from "./discover-journal-files";
import { filterIndexLinks } from "./filter-index-links";
import { normalizeJournalEntry, type JournalEntry } from "./normalize-journal-entry";

export interface GenerateJournalContentOptions {
  outputRoot: string;
  root: string;
}

export interface JournalManifest {
  actionItems: Array<{
    date?: string;
    project: string;
    route: string;
    sourcePath: string;
    text: string;
  }>;
  archives: Array<{
    date?: string;
    project: string;
    sourcePath: string;
    title: string;
    type: JournalEntry["type"];
  }>;
  entries: JournalEntry[];
  generatedAt: string;
  projects: Array<{
    commitCount: number;
    lastActivity?: string;
    name: string;
    sessionCount: number;
  }>;
}

function outputPathFor(entry: JournalEntry, outputRoot: string): string {
  const relativeRoute = entry.route.replace(/^\//, "");
  const relativePath =
    entry.type === "project-index"
      ? join(relativeRoute, "index.md")
      : `${relativeRoute}.md`;

  const destination = resolve(outputRoot, relativePath);
  const within = relative(resolve(outputRoot), destination);
  if (within.startsWith("..") || isAbsolute(within)) {
    throw new Error("Journal path leaves generated output");
  }
  return destination;
}

// Archived entries expose metadata only. Their bodies never reach generated content.
async function readArchives(root: string): Promise<JournalManifest["archives"]> {
  const archiveRoot = join(root, ARCHIVE_ROOT);
  let archivedPaths: string[];
  try {
    archivedPaths = await discoverJournalFiles(archiveRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const archives: JournalManifest["archives"] = [];
  for (const sourcePath of archivedPaths) {
    const entry = normalizeJournalEntry({
      markdown: await readFile(join(archiveRoot, sourcePath), "utf8"),
      sourcePath,
    });
    if (entry.type !== "session" && entry.type !== "commit") continue;
    archives.push({
      date: entry.metadata.date,
      project: entry.project,
      sourcePath,
      title: entry.title,
      type: entry.type,
    });
  }
  return archives.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export async function generateJournalContent({
  outputRoot,
  root,
}: GenerateJournalContentOptions): Promise<JournalManifest> {
  if (!outputRoot.split("/").includes(".generated")) {
    throw new Error("Generated journal output must stay inside .generated");
  }

  await rm(outputRoot, { force: true, recursive: true });
  const entries: JournalEntry[] = [];
  const sourcePaths = await discoverJournalFiles(root);
  const existingPaths = new Set(sourcePaths);

  for (const sourcePath of sourcePaths) {
    const raw = await readFile(join(root, sourcePath), "utf8");
    const markdown = sourcePath.endsWith("/INDEX.md")
      ? filterIndexLinks(raw, sourcePath, existingPaths)
      : raw;
    const entry = normalizeJournalEntry({ markdown, sourcePath });
    const destination = outputPathFor(entry, outputRoot);
    const frontmatter = {
      ...(entry.metadata.date ? { date: entry.metadata.date } : {}),
      ...(entry.metadata.model ? { model: entry.metadata.model } : {}),
      project: entry.project,
      search: {
        tags: [
          `project/${entry.project}`,
          `type/${entry.type}`,
          ...entry.metadata.tags,
        ],
      },
      ...(entry.metadata.sessionId
        ? { session_id: entry.metadata.sessionId }
        : {}),
      sidebar: { hidden: true },
      ...(entry.metadata.source ? { source: entry.metadata.source } : {}),
      tags: entry.metadata.tags,
      title: entry.title,
      type: entry.type,
    };

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, matter.stringify(entry.body, frontmatter));
    entries.push(entry);
  }

  const projectMap = new Map<string, JournalManifest["projects"][number]>();
  const actionItems: JournalManifest["actionItems"] = [];
  for (const entry of entries) {
    if (entry.type !== "home") {
      const project = projectMap.get(entry.project) ?? {
        commitCount: 0,
        name: entry.project,
        sessionCount: 0,
      };
      if (entry.type === "commit") project.commitCount += 1;
      if (entry.type === "session") project.sessionCount += 1;
      if (
        entry.metadata.date &&
        (!project.lastActivity || entry.metadata.date > project.lastActivity)
      ) {
        project.lastActivity = entry.metadata.date;
      }
      projectMap.set(entry.project, project);
    }
    if (entry.type === "session") {
      for (const match of entry.body.matchAll(/^- \[ \] (.+)$/gm)) {
        actionItems.push({
          date: entry.metadata.date,
          project: entry.project,
          route: entry.route,
          sourcePath: entry.sourcePath,
          text: match[1].trim(),
        });
      }
    }
  }

  const manifest: JournalManifest = {
    actionItems: actionItems.sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? ""),
    ),
    archives: await readArchives(root),
    entries,
    generatedAt: new Date().toISOString(),
    projects: [...projectMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };

  await mkdir(outputRoot, { recursive: true });
  await writeFile(
    join(outputRoot, "journal-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}
