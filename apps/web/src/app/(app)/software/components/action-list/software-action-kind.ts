import { SoftwareActionKind } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

/** The ACTION column's word for each kind of run, exhaustively (see `presentationFor`). */
const SOFTWARE_ACTION_KIND_LABEL: Record<SoftwareActionKind, string> = {
  [SoftwareActionKind.INSTALL]: 'Install',
  [SoftwareActionKind.UPDATE]: 'Update',
  // Started by an auto-update policy when a new version came out.
  [SoftwareActionKind.AUTO_UPDATE]: 'Auto-update',
  // A manually installed copy reinstalled with a package manager.
  [SoftwareActionKind.ADOPT]: 'Adopt',
};

/** The kind as the row words it — the Action funnel says the same. Undefined for one this build does not know. */
export function softwareActionKindLabel(kind: string): string | undefined {
  return presentationFor(SOFTWARE_ACTION_KIND_LABEL, kind);
}
