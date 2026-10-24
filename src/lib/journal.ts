import manifestJson from "../../.generated/content/journal-manifest.json";
import type { JournalManifest } from "../content/generate-journal-content";

export const manifest = manifestJson as JournalManifest;

export const dateLabel = (value?: string): string => {
  if (!value) return "Undated";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const recentSessions = [...manifest.entries]
  .filter((entry) => entry.type === "session")
  .sort((a, b) =>
    (b.metadata.date ?? "").localeCompare(a.metadata.date ?? ""),
  );
