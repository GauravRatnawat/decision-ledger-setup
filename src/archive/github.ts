export interface GitHubConfig {
  branch: string;
  repo: string;
  token: string;
}

export interface MoveRequest {
  from: string;
  message: string;
  to: string;
}

export type MoveResult =
  | { status: "moved"; commit: string }
  | { status: "missing" }
  | { status: "occupied" }
  | { status: "conflict" };

export class GitHubError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
  ) {
    super(`GitHub ${operation} failed with ${status}`);
  }
}

const MAX_ATTEMPTS = 3;

type Fetch = typeof fetch;

function client(config: GitHubConfig, fetcher: Fetch) {
  const base = `https://api.github.com/repos/${config.repo}`;

  return async function call(
    path: string,
    init: { body?: unknown; method?: string } = {},
  ): Promise<Response> {
    return fetcher(`${base}${path}`, {
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "User-Agent": "decision-ledger-archive",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: init.method ?? "GET",
    });
  };
}

async function json<T>(response: Response, operation: string): Promise<T> {
  if (!response.ok) throw new GitHubError(operation, response.status);
  return (await response.json()) as T;
}

const encodePath = (path: string): string =>
  path.split("/").map(encodeURIComponent).join("/");

// One atomic commit: add `to` with same blob, delete `from`. Ref update never forced.
export async function moveFile(
  config: GitHubConfig,
  move: MoveRequest,
  fetcher: Fetch = fetch,
): Promise<MoveResult> {
  const call = client(config, fetcher);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const ref = await json<{ object: { sha: string } }>(
      await call(`/git/ref/heads/${config.branch}`),
      "read ref",
    );
    const head = ref.object.sha;

    const source = await call(`/contents/${encodePath(move.from)}?ref=${head}`);
    if (source.status === 404) return { status: "missing" };
    const blob = await json<{ sha: string; type: string }>(source, "read source");
    if (blob.type !== "file") return { status: "missing" };

    const destination = await call(`/contents/${encodePath(move.to)}?ref=${head}`);
    if (destination.status !== 404) {
      if (!destination.ok) throw new GitHubError("read destination", destination.status);
      return { status: "occupied" };
    }

    const headCommit = await json<{ tree: { sha: string } }>(
      await call(`/git/commits/${head}`),
      "read commit",
    );
    const tree = await json<{ sha: string }>(
      await call("/git/trees", {
        body: {
          base_tree: headCommit.tree.sha,
          tree: [
            { mode: "100644", path: move.to, sha: blob.sha, type: "blob" },
            { mode: "100644", path: move.from, sha: null, type: "blob" },
          ],
        },
        method: "POST",
      }),
      "create tree",
    );
    const commit = await json<{ sha: string }>(
      await call("/git/commits", {
        body: { message: move.message, parents: [head], tree: tree.sha },
        method: "POST",
      }),
      "create commit",
    );

    const update = await call(`/git/refs/heads/${config.branch}`, {
      body: { force: false, sha: commit.sha },
      method: "PATCH",
    });
    // 422 = branch moved under us (recorder push). Rebuild on new head.
    if (update.status === 422) continue;
    await json(update, "update ref");
    return { commit: commit.sha, status: "moved" };
  }

  return { status: "conflict" };
}
