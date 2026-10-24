import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, expect, it } from "vitest";

import { verifyOwner, type AccessConfig } from "../../src/archive/access";

const config: AccessConfig = {
  aud: "aud-tag",
  ownerEmail: "owner@example.com",
  teamDomain: "https://team.cloudflareaccess.com",
};

let privateKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), alg: "RS256", kid: "k1" }],
  });
});

async function token(claims: Record<string, unknown>, key = privateKey): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(config.teamDomain)
    .setAudience(config.aud)
    .setExpirationTime("5m")
    .sign(key);
}

const request = (jwt?: string) =>
  new Request("https://journal.test/api/archive", {
    headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {},
  });

it("accepts a signed Access token for the owner email", async () => {
  expect(await verifyOwner(request(await token({ email: "Owner@Example.com" })), config, keys)).toBe(
    "owner",
  );
});

it("forbids a valid token for another email", async () => {
  expect(await verifyOwner(request(await token({ email: "x@example.com" })), config, keys)).toBe(
    "forbidden",
  );
});

it("rejects a missing token", async () => {
  expect(await verifyOwner(request(), config, keys)).toBe("unauthenticated");
});

it("rejects a token signed by another key", async () => {
  const other = await generateKeyPair("RS256");
  const jwt = await token({ email: config.ownerEmail }, other.privateKey);
  expect(await verifyOwner(request(jwt), config, keys)).toBe("unauthenticated");
});

it("rejects a token for another Access application", async () => {
  const jwt = await new SignJWT({ email: config.ownerEmail })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(config.teamDomain)
    .setAudience("other-app")
    .setExpirationTime("5m")
    .sign(privateKey);
  expect(await verifyOwner(request(jwt), config, keys)).toBe("unauthenticated");
});

it("rejects an unsigned token that only claims the owner email", async () => {
  const header = btoa(JSON.stringify({ alg: "none" }));
  const body = btoa(JSON.stringify({ aud: config.aud, email: config.ownerEmail, iss: config.teamDomain }));
  expect(await verifyOwner(request(`${header}.${body}.`), config, keys)).toBe("unauthenticated");
});
