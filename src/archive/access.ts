import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessConfig {
  aud: string;
  ownerEmail: string;
  teamDomain: string;
}

export type OwnerCheck = "owner" | "unauthenticated" | "forbidden";

const remoteKeys = new Map<string, JWTVerifyGetKey>();

function keysFor(teamDomain: string): JWTVerifyGetKey {
  const cached = remoteKeys.get(teamDomain);
  if (cached) return cached;
  const keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
  remoteKeys.set(teamDomain, keys);
  return keys;
}

// Second lock behind Cloudflare Access: token can write repo, so never trust headers alone.
export async function verifyOwner(
  request: Request,
  config: AccessConfig,
  keys: JWTVerifyGetKey = keysFor(config.teamDomain),
): Promise<OwnerCheck> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return "unauthenticated";

  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      audience: config.aud,
      issuer: config.teamDomain.replace(/\/$/, ""),
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    return email.toLowerCase() === config.ownerEmail.toLowerCase()
      ? "owner"
      : "forbidden";
  } catch {
    return "unauthenticated";
  }
}
