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
