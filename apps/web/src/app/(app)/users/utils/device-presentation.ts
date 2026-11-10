import { formatDistanceToNowStrict } from 'date-fns';
import { DirectoryMatchKey, DirectoryProvider } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { toValidDate } from '@/lib/format-date';

/** Where a directory record comes from, as a row names it and as a group's member list names it. */
interface DeviceOrigin {
  /** "Entra ID, last seen 20 minutes ago" (Figma 1014:1660). */
  name: string;
  /** "Entra device" (Figma 733:99325). */
  member: string;
}

const INTUNE: DeviceOrigin = { name: 'Intune', member: 'Intune device' };
const CHROMEOS: DeviceOrigin = { name: 'ChromeOS', member: 'ChromeOS device' };
const MOBILE: DeviceOrigin = { name: 'Google Workspace', member: 'Mobile device' };
const ENTRA: DeviceOrigin = { name: 'Entra ID', member: 'Entra device' };
const GOOGLE: DeviceOrigin = { name: 'Google Workspace', member: 'Google device' };

/** D35: there is no device kind. A record is told apart by its source and the prefix of its `sourceId`. */
export function deviceOrigin(source: string, sourceId: string): DeviceOrigin {
  if (sourceId.startsWith('intune:')) return INTUNE;
  if (sourceId.startsWith('chromeos:')) return CHROMEOS;
  if (sourceId.startsWith('mobile:')) return MOBILE;
  return source === DirectoryProvider.MICROSOFT_365 ? ENTRA : GOOGLE;
}

/** The line under a record's name: where it comes from and, when the provider says, when it was last seen. */
export function recordDetail(origin: DeviceOrigin, lastSeenAt: string | null | undefined): string {
  const at = toValidDate(lastSeenAt);
  return at ? `${origin.name}, last seen ${formatDistanceToNowStrict(at, { addSuffix: true })}` : origin.name;
}

const MATCH_KEYS = {
  [DirectoryMatchKey.HOSTNAME]: 'Hostname',
  [DirectoryMatchKey.OS]: 'OS',
  [DirectoryMatchKey.SERIAL_NUMBER]: 'Serial Number',
} satisfies Record<DirectoryMatchKey, string>;

/** The WHY column: the keys that agree (D24), "Hostname, OS". */
export function matchedKeysLabel(keys: readonly string[]): string {
  return keys.map(key => presentationFor(MATCH_KEYS, key) ?? key).join(', ');
}

/** The Link modal's first line under a machine's name: "Laptop, Windows 11 23H2" (Figma 1284:173). */
export function machineSummary(type: string | null | undefined, osVersion: string | null | undefined): string {
  const typeLabel = type ? `${type.charAt(0)}${type.slice(1).toLowerCase()}` : null;
  return [typeLabel, osVersion].filter(Boolean).join(', ');
}

/** The Link modal's second line: "Serial number CND9921, no directory record" (Figma 1284:173). */
export function machineLinkFacts(serialNumber: string | null | undefined, directorySources: readonly string[]): string {
  return [
    serialNumber ? `Serial number ${serialNumber}` : null,
    directorySources.length === 0 ? 'no directory record' : 'already has a directory record',
  ]
    .filter(Boolean)
    .join(', ');
}
