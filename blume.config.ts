import { defineConfig } from "blume";
import { z } from "zod";

export default defineConfig({
  title: "Decision Ledger",
  description: "A private, searchable record of engineering decisions and evidence.",
  content: {
    root: ".generated/content",
    pages: "pages",
  },
  frontmatter: {
    extend: {
      model: z.string().optional(),
      project: z.string().optional(),
      session_id: z.string().optional(),
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  theme: {
    accent: "#A63A2B",
    action: "#A63A2B",
    background: "#EDF1EA",
    mode: "light",
    radius: "sm",
  },
  search: {
    indexing: {
      includeHiddenPages: true,
    },
    provider: "orama",
  },
  feedback: false,
  ai: {
    llmsTxt: false,
  },
  seo: {
    agentReadability: false,
    og: { enabled: false },
    robots: false,
    rss: { enabled: false },
    sitemap: false,
    structuredData: false,
  },
  deployment: {
    output: "static",
    site: process.env.JOURNAL_SITE_URL ?? "http://localhost:4321",
  },
});
