// How the Remote Sessions lists put their running sessions together with the
// rest. `RemoteSession` has no global id, so Relay keeps every copy of a session
// it reads; the lists make one row per session themselves.

type SessionRow = { readonly id: string };

/**
 * One row per session, the first copy kept. Pages loaded at different times can
 * hold the same session twice: one that was running when the first page came
 * and had ended by the time a later page did.
 */
export function uniqueSessions<T extends SessionRow>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * The list with its running sessions as the latest poll read them: those first,
 * in the poll's order (the first page's), then the list's other rows. Before the
 * poll has answered (`polled` null) the list is shown as it came.
 */
export function withPolledLiveRows<T extends SessionRow>(rows: readonly T[], polled: readonly T[] | null): T[] {
  if (polled === null) return uniqueSessions(rows);
  const polledIds = new Set(polled.map(row => row.id));
  return uniqueSessions([...polled, ...rows.filter(row => !polledIds.has(row.id))]);
}

/** The sessions the list still shows running that the poll no longer returns: they have ended. */
export function endedLiveRows<T extends SessionRow & { readonly live: boolean }>(
  rows: readonly T[],
  polled: readonly T[],
): string[] {
  const polledIds = new Set(polled.map(row => row.id));
  return rows.filter(row => row.live && !polledIds.has(row.id)).map(row => row.id);
}
