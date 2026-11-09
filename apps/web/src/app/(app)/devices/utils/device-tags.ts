import type { DeviceTag } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { deviceRowFields_machine$data } from '@/__generated__/deviceRowFields_machine.graphql';

/**
 * A `MachineTag` as the row step selects it, with everything past the ids and
 * the key optional — the device DETAIL page still reads its node over raw POST
 * and carries a looser shape. Derived from the fragment rather than restated, so
 * the field names stay bound to the schema.
 *
 * Kept apart from `device-transform.ts` on purpose: that module carries graphql
 * tags, which vitest cannot load without the Relay babel plugin, and this mapper
 * is the part worth testing on its own.
 */
type MachineTagFields = deviceRowFields_machine$data['tagAssignments'][number];
type MachineTagFieldsLike = Partial<Omit<MachineTagFields, 'tag'>> &
  Pick<MachineTagFields, 'id'> & {
    tag: Partial<MachineTagFields['tag']> & Pick<MachineTagFields['tag'], 'id' | 'key'>;
  };

/**
 * Maps a device's `MachineTag` nodes to `DeviceTag`.
 *
 * `tagId`, `key`, `description` and `color` come from the tag definition, so
 * filters and colour lookups keep keying by it; `values` and `createdAt` (the
 * date this device was tagged) come from the assignment. Relay hands back
 * readonly arrays, so `values` is copied rather than cast.
 */
export function toDeviceTags(
  assignments: ReadonlyArray<MachineTagFieldsLike | null | undefined> | null | undefined,
): DeviceTag[] {
  return (assignments ?? []).flatMap(assignment =>
    assignment
      ? [
          {
            tagId: assignment.tag.id,
            key: assignment.tag.key,
            description: assignment.tag.description ?? undefined,
            color: assignment.tag.color ?? undefined,
            values: [...(assignment.values ?? [])],
            createdAt: assignment.taggedAt ?? undefined,
          },
        ]
      : [],
  );
}
