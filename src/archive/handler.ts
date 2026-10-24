import type { JWTVerifyGetKey } from "jose";

import { verifyOwner } from "./access";
import { GitHubError, moveFile } from "./github";
import { archivePathFor, validateEntryPath } from "./path";

export interface ArchiveEnv {
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
  GITHUB_BRANCH?: string;
  GITHUB_REPO?: string;
  GITHUB_TOKEN?: string;
  OWNER_EMAIL?: string;
}

export interface ArchiveDeps {
  fetcher?: typeof fetch;
  keys?: JWTVerifyGetKey;
}

export type MoveMode = "archive" | "restore";

const reply = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
    status,
  });

const fail = (status: number, error: string): Response => reply(status, { error, ok: false });

async function readPath(request: Request): Promise<string | undefined> {
  try {
    const body = (await request.json()) as { path?: unknown };
    return validateEntryPath(body?.path);
  } catch {
    return undefined;
  }
}

export async function handleMove(
  request: Request,
  env: ArchiveEnv,
  mode: MoveMode,
  deps: ArchiveDeps = {},
): Promise<Response> {
  if (request.method !== "POST") return fail(405, "Method not allowed");
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    return fail(415, "JSON required");
  }
  // ponytail: preview has no token on purpose, so preview never writes master.
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.OWNER_EMAIL || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) {
    return fail(503, "Archive is not configured here");
  }

  const owner = await verifyOwner(
    request,
    { aud: env.ACCESS_AUD, ownerEmail: env.OWNER_EMAIL, teamDomain: env.ACCESS_TEAM_DOMAIN },
    deps.keys,
  );
  if (owner === "unauthenticated") return fail(401, "Sign in required");
  if (owner === "forbidden") return fail(403, "Not allowed");

  const path = await readPath(request);
  if (!path) return fail(400, "Not an archivable entry");

  const archived = archivePathFor(path);
  const move =
    mode === "archive"
      ? { from: path, message: `archive: ${path} leaves Decision Ledger`, to: archived }
      : { from: archived, message: `restore: ${path} returns to Decision Ledger`, to: path };

  try {
    const result = await moveFile(
      {
        branch: env.GITHUB_BRANCH ?? "master",
        repo: env.GITHUB_REPO,
        token: env.GITHUB_TOKEN,
      },
      move,
      deps.fetcher,
    );
    switch (result.status) {
      case "moved":
        return reply(200, { commit: result.commit, ok: true });
      case "missing":
        return fail(404, "Entry not found");
      case "occupied":
        return fail(409, "Destination already exists");
      case "conflict":
        return fail(409, "Journal changed too fast, try again");
    }
  } catch (error) {
    const detail =
      error instanceof GitHubError ? `${error.operation} ${error.status}` : "unexpected";
    console.error(`${mode} failed for ${path}: ${detail}`);
    return fail(502, "GitHub unavailable, try again");
  }
}
