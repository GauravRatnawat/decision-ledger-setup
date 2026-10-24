export type MoveOutcome = { ok: true } | { error: string; ok: false };

// Browser side of /api/archive and /api/restore. Server messages are short and safe to show.
export async function requestMove(
  mode: "archive" | "restore",
  path: string,
): Promise<MoveOutcome> {
  try {
    const response = await fetch(`/api/${mode}`, {
      body: JSON.stringify({ path }),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    return {
      error: typeof body.error === "string" ? body.error : `Failed (${response.status})`,
      ok: false,
    };
  } catch {
    return { error: "Network error, try again", ok: false };
  }
}
