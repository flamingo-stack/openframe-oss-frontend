/**
 * Single source of truth for a device's display name.
 *
 * The name comes from GraphQL only: the user-defined `nickname` when set,
 * then `displayName`, then `hostname`. No other fallbacks (description,
 * machineId, deviceId, Fleet display_name, …) — those diverge across screens
 * and must not be used.
 */
export function getDeviceName(
  device?: { nickname?: string | null; displayName?: string | null; hostname?: string | null } | null,
): string {
  return device?.nickname || device?.displayName || device?.hostname || '';
}

/**
 * Whether a client-side device list finds `device` by `search`: through the
 * name it renders under, or through its hostname.
 *
 * Hostname stays a match even when a nickname is set, on purpose. The server's
 * `devices(search:)` matches hostname regardless of nickname (alongside ip,
 * serial, manufacturer, model), and a list that filters what it already
 * loaded must not be stricter than the page it stands in for — a device an
 * admin knows by hostname from Fleet or MeshCentral stays findable after
 * someone gives it a nickname.
 *
 * Case-insensitive substring, like the server. Blank search matches everything.
 */
export function matchesDeviceName(
  device?: { nickname?: string | null; displayName?: string | null; hostname?: string | null } | null,
  search = '',
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    getDeviceName(device).toLowerCase().includes(needle) || (device?.hostname ?? '').toLowerCase().includes(needle)
  );
}
