// Tiny in-memory GitHub: one branch, flat path -> blob sha map per commit.
export interface FakeGitHub {
  calls: string[];
  fetcher: typeof fetch;
  files: () => Map<string, string>;
  head: () => string;
  messages: string[];
  /** Simulate recorder pushes landing right before our next N ref updates. */
  racePushes: (count: number) => void;
  failNext: (operation: string, status: number) => void;
}

export function fakeGitHub(initial: Record<string, string>): FakeGitHub {
  const commits = new Map<string, Map<string, string>>([["c0", new Map(Object.entries(initial))]]);
  const trees = new Map<string, Map<string, string>>();
  const parents = new Map<string, string>();
  let head = "c0";
  let counter = 0;
  let races = 0;
  const failures = new Map<string, number>();
  const calls: string[] = [];
  const messages: string[] = [];

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status });

  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const key = `${method} ${path.split("/").slice(0, 3).join("/")}`;
    calls.push(`${method} ${path}`);

    const forced = failures.get(key);
    if (forced) {
      failures.delete(key);
      return json(forced, { message: "boom" });
    }

    if (method === "GET" && path === "/git/ref/heads/master") {
      return json(200, { object: { sha: head } });
    }
    if (method === "GET" && path.startsWith("/contents/")) {
      const file = decodeURIComponent(path.slice("/contents/".length));
      const sha = commits.get(url.searchParams.get("ref") ?? head)?.get(file);
      return sha ? json(200, { sha, type: "file" }) : json(404, { message: "Not Found" });
    }
    if (method === "GET" && path.startsWith("/git/commits/")) {
      const sha = path.slice("/git/commits/".length);
      trees.set(`t-${sha}`, commits.get(sha)!);
      return json(200, { tree: { sha: `t-${sha}` } });
    }
    if (method === "POST" && path === "/git/trees") {
      const next = new Map(trees.get(body.base_tree));
      for (const item of body.tree) {
        if (item.sha === null) next.delete(item.path);
        else next.set(item.path, item.sha);
      }
      const sha = `t${(counter += 1)}`;
      trees.set(sha, next);
      return json(201, { sha });
    }
    if (method === "POST" && path === "/git/commits") {
      const sha = `c${(counter += 1)}`;
      commits.set(sha, trees.get(body.tree)!);
      messages.push(body.message);
      parents.set(sha, body.parents[0]);
      return json(201, { sha });
    }
    if (method === "PATCH" && path === "/git/refs/heads/master") {
      if (races > 0) {
        races -= 1;
        const pushed = new Map(commits.get(head));
        pushed.set(`recorder/${counter}.md`, `b-recorder-${counter}`);
        const sha = `c${(counter += 1)}`;
        commits.set(sha, pushed);
        head = sha;
      }
      if (body.force !== false) throw new Error("ref update must never force");
      if (parents.get(body.sha) !== head) return json(422, { message: "Update is not a fast forward" });
      head = body.sha;
      return json(200, { object: { sha: head } });
    }
    return json(500, { message: `unhandled ${method} ${path}` });
  }) as typeof fetch;

  return {
    calls,
    failNext: (operation, status) => failures.set(operation, status),
    fetcher,
    files: () => commits.get(head)!,
    head: () => head,
    messages,
    racePushes: (count) => {
      races = count;
    },
  };
}
