import { expect, it } from "vitest";

import { GitHubError, moveFile } from "../../src/archive/github";
import { fakeGitHub } from "./fake-github";

const config = { branch: "master", repo: "o/r", token: "t" };
const SOURCE = "example/2026-10-23_x.md";
const ARCHIVED = ".archive/example/2026-10-23_x.md";
const move = { from: SOURCE, message: "archive: x", to: ARCHIVED };

it("moves the blob in one commit without touching other files", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1", "example/INDEX.md": "b2" });

  const result = await moveFile(config, move, github.fetcher);

  expect(result).toEqual({ commit: github.head(), status: "moved" });
  expect(Object.fromEntries(github.files())).toEqual({ [ARCHIVED]: "b1", "example/INDEX.md": "b2" });
  expect(github.messages).toEqual(["archive: x"]);
});

it("reports a missing source without writing", async () => {
  const github = fakeGitHub({});

  expect(await moveFile(config, move, github.fetcher)).toEqual({ status: "missing" });
  expect(github.head()).toBe("c0");
});

it("refuses to overwrite an occupied destination", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1", [ARCHIVED]: "b9" });

  expect(await moveFile(config, move, github.fetcher)).toEqual({ status: "occupied" });
  expect(github.head()).toBe("c0");
});

it("rebuilds on the new head when a recorder push wins the race", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1" });
  github.racePushes(2);

  const result = await moveFile(config, move, github.fetcher);

  expect(result.status).toBe("moved");
  const files = github.files();
  expect(files.get(ARCHIVED)).toBe("b1");
  expect(files.has(SOURCE)).toBe(false);
  // Both recorder pushes survive: nothing was force-overwritten.
  expect([...files.keys()].filter((path) => path.startsWith("recorder/"))).toHaveLength(2);
});

it("gives up with a conflict after three lost races", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1" });
  github.racePushes(3);

  expect(await moveFile(config, move, github.fetcher)).toEqual({ status: "conflict" });
  expect(github.files().has(SOURCE)).toBe(true);
});

it("surfaces GitHub failures without a ref update", async () => {
  const github = fakeGitHub({ [SOURCE]: "b1" });
  github.failNext("POST /git/trees", 500);

  await expect(moveFile(config, move, github.fetcher)).rejects.toBeInstanceOf(GitHubError);
  expect(github.calls.some((call) => call.startsWith("PATCH"))).toBe(false);
});
