import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, expect, it, vi } from "vitest";

import { handleMove, type ArchiveEnv } from "../../src/archive/handler";
import { fakeGitHub } from "./fake-github";

const env: ArchiveEnv = {
  ACCESS_AUD: "aud-tag",
  ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  GITHUB_REPO: "o/r",
  GITHUB_TOKEN: "t",
  OWNER_EMAIL: "owner@example.com",
};
const SOURCE = "example/2026-10-23_x.md";
const ARCHIVED = ".archive/example/2026-10-23_x.md";

let ownerJwt: string;
let strangerJwt: string;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1" }] });
  const sign = (email: string) =>
    new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(env.ACCESS_TEAM_DOMAIN!)
      .setAudience(env.ACCESS_AUD!)
      .setExpirationTime("5m")
      .sign(pair.privateKey);
  ownerJwt = await sign(env.OWNER_EMAIL!);
  strangerJwt = await sign("x@example.com");
});

function request(
  body: unknown,
  { jwt = ownerJwt, method = "POST", type = "application/json" } = {},
): Request {
  return new Request("https://journal.test/api/archive", {
    body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Cf-Access-Jwt-Assertion": jwt, "Content-Type": type },
    method,
  });
}

it("archives then restores an entry through two commits", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1" });
  const deps = { fetcher: github.fetcher, keys };

  const archived = await handleMove(request({ path: SOURCE }), env, "archive", deps);
  expect(archived.status).toBe(200);
  expect(await archived.json()).toEqual({ commit: github.head(), ok: true });
  expect([...github.files().keys()]).toEqual([ARCHIVED]);

  const restored = await handleMove(request({ path: SOURCE }), env, "restore", deps);
  expect(restored.status).toBe(200);
  expect([...github.files().keys()]).toEqual([SOURCE]);
  expect(github.messages).toEqual([
    `archive: ${SOURCE} leaves Decision Ledger`,
    `restore: ${SOURCE} returns to Decision Ledger`,
  ]);
});

it.each([
  ["non-POST", () => request(undefined, { method: "GET" }), env, 405],
  ["form post", () => request({ path: SOURCE }, { type: "text/plain" }), env, 415],
  ["preview without token", () => request({ path: SOURCE }), { ...env, GITHUB_TOKEN: undefined }, 503],
  ["missing Access token", () => request({ path: SOURCE }, { jwt: "" }), env, 401],
  ["another Access user", () => request({ path: SOURCE }, { jwt: strangerJwt }), env, 403],
  ["protected index", () => request({ path: "example/INDEX.md" }), env, 400],
  ["traversal", () => request({ path: "../example/2026-10-23_x.md" }), env, 400],
  ["broken JSON", () => request("{"), env, 400],
])("rejects %s with %i and never writes", async (_label, makeRequest, testEnv, status) => {
  const github = fakeGitHub({ [SOURCE]: "b1" });

  const response = await handleMove(makeRequest(), testEnv, "archive", { fetcher: github.fetcher, keys });

  expect(response.status).toBe(status);
  expect(github.head()).toBe("c0");
});

it("requires explicit archive target repo before calling GitHub", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1" });
  const response = await handleMove(request({ path: SOURCE }), { ...env, GITHUB_REPO: undefined }, "archive", {
    fetcher: github.fetcher, keys,
  });
  expect(response.status).toBe(503);
  expect(github.calls).toEqual([]);
});

it("returns 404 for an entry that is not in the repository", async () => {
  const github = fakeGitHub({});
  const response = await handleMove(request({ path: SOURCE }), env, "archive", {
    fetcher: github.fetcher,
    keys,
  });
  expect(response.status).toBe(404);
});

it("returns 409 when restore would overwrite a reused path", async () => {
  const github = fakeGitHub({ [SOURCE]: "new", [ARCHIVED]: "old" });
  const response = await handleMove(request({ path: SOURCE }), env, "restore", {
    fetcher: github.fetcher,
    keys,
  });
  expect(response.status).toBe(409);
});

it("hides GitHub internals behind a 502", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1" });
  github.failNext("GET /git/ref", 500);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

  const response = await handleMove(request({ path: SOURCE }), env, "archive", {
    fetcher: github.fetcher,
    keys,
  });

  expect(response.status).toBe(502);
  expect(JSON.stringify(await response.json())).not.toMatch(/boom|token/i);
  expect(log.mock.calls[0]?.[0]).not.toContain(env.GITHUB_TOKEN);
  log.mockRestore();
});
