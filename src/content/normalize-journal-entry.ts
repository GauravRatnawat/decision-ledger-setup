import matter from "gray-matter";

export interface NormalizeJournalEntryInput {
  markdown: string;
  sourcePath: string;
}

export interface JournalEntry {
  body: string;
  metadata: {
    date?: string;
    model?: string;
    sessionId?: string;
    source?: string;
    tags: string[];
  };
  project: string;
  route: string;
  sourcePath: string;
  title: string;
  type: "commit" | "home" | "project-index" | "session";
}

export function normalizeJournalEntry({
  markdown,
  sourcePath,
}: NormalizeJournalEntryInput): JournalEntry {
  const parseableMarkdown = markdown.replace(
    /^(title:\s*)(?!["'])(.+)$/m,
    (_match, prefix: string, value: string) =>
      `${prefix}${JSON.stringify(value.trim())}`,
  );
  const parsed = matter(parseableMarkdown);
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const title = typeof parsed.data.title === "string" ? parsed.data.title : undefined;
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const filename = sourcePath.split("/").at(-1)?.replace(/\.mdx?$/, "") ?? "";
  const filenameTitle = filename
    .replace(/^\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2})?[_-]?/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const pathParts = sourcePath.split("/");
  const project = sourcePath === "HOME.md"
    ? "journal"
    : typeof parsed.data.project === "string"
      ? parsed.data.project
      : (pathParts[0] ?? "");
  if (!/^[A-Za-z0-9][\w.-]*$/.test(project) || project === "." || project === "..") {
    throw new Error("Unsafe journal project path");
  }
  const isCommit = pathParts[1] === "commits";
  const isHome = sourcePath === "HOME.md";
  const isProjectIndex = filename === "INDEX";
  const slug = /^\d/.test(filename) ? `d-${filename}` : filename;
  const filenameDate = filename.match(
    /^(\d{4}-\d{2}-\d{2})(?:[_-](\d{2})[-_:]?(\d{2}))?/,
  );
  const rawDate =
    frontmatter?.[1].match(/^date:\s*(.+)$/m)?.[1]?.trim() ??
    (filenameDate
      ? `${filenameDate[1]}${filenameDate[2] ? `T${filenameDate[2]}:${filenameDate[3] ?? "00"}:00` : ""}`
      : undefined);
  const body = parsed.content
    .trim()
    .replace(/^#\s+.+(?:\r?\n|$)/, "")
    .replace(/```dataview[\s\S]*?```/g, "")
    .trim()
    .replace(
      /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
      (_match, target: string, label?: string) => {
        const normalizedTarget = target.replace(/\.md$/, "");
        const targetParts = normalizedTarget.split("/");
        const rawTargetFilename = targetParts.pop() ?? "";
        const targetFilename = /^\d/.test(rawTargetFilename)
          ? `d-${rawTargetFilename}`
          : rawTargetFilename;
        const route = normalizedTarget.endsWith("/INDEX")
          ? `/projects/${normalizedTarget.split("/")[0]}`
          : `/projects/${[...targetParts, targetFilename].join("/")}`;

        return `[${label ?? target}](${route})`;
      },
    );

  return {
    body,
    metadata: {
      date: rawDate,
      model: typeof parsed.data.model === "string" ? parsed.data.model : undefined,
      sessionId:
        typeof parsed.data.session_id === "string"
          ? parsed.data.session_id
          : undefined,
      source:
        typeof parsed.data.source === "string" ? parsed.data.source : undefined,
      tags: Array.isArray(parsed.data.tags)
        ? parsed.data.tags.map((tag) => String(tag))
        : [],
    },
    project,
    route: isHome
      ? "/source/home"
      : isProjectIndex
        ? `/source/projects/${project}`
        : isCommit
          ? `/projects/${project}/commits/${slug}`
          : `/projects/${project}/${slug}`,
    sourcePath,
    title:
      title ??
      heading ??
      `${filenameTitle.charAt(0).toUpperCase()}${filenameTitle.slice(1)}`,
    type: isHome
      ? "home"
      : isProjectIndex
        ? "project-index"
        : isCommit
          ? "commit"
          : "session",
  };
}
