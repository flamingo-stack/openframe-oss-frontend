'use client';
'use no memo';

import {
  ICON_OPTIONS,
  type QuickActionAccent,
  renderQuickActionIcon,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { SearchableSelect, type SearchableSelectOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { type Control, Controller } from 'react-hook-form';
import type { QuickActionsFormValues } from '../types/quick-action.types';

interface QuickActionIconSelectProps {
  /** Row index inside the `quickActions` field array. */
  index: number;
  control: Control<QuickActionsFormValues>;
  /** Glyph tint: the agent's accent (`resolveQuickActionAccent`), so the picker previews the chip. */
  accent?: QuickActionAccent;
  className?: string;
}

/** "grid-check" → "Grid check": a caption for a glyph key the curated list has no label for. */
const captionFromKey = (key: string) => {
  const words = key.replace(/-\d+$/, '').split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The "Icon" field of a quick-action row: a searchable grid of the core-lib
 * icon registry (`ICON_OPTIONS`, the same curated set the Product Hub admin
 * picks from), each tile rendered through `renderQuickActionIcon` so it looks
 * exactly like the chat chip it will become. Stores the glyph key in
 * `quickActions[index].iconName`; the search matches the label and the key.
 *
 * A stored key outside the curated set (the hub defaults use a few — e.g.
 * `grid-check`, `usb` — and the editor seeds `iconName` from them when
 * defaults are turned off) is kept as a leading extra tile: the trigger shows
 * the glyph the chip already draws instead of an empty "Select icon", and the
 * value survives a save untouched. Picking any tile replaces it.
 */
export function QuickActionIconSelect({ index, control, accent, className }: QuickActionIconSelectProps) {
  const options = useMemo<SearchableSelectOption[]>(
    () =>
      ICON_OPTIONS.map(option => ({
        value: option.key,
        label: option.label,
        keywords: [option.key],
        icon: renderQuickActionIcon({ name: option.key, accent, size: 24 }),
      })),
    [accent],
  );

  const optionsWith = (current: string | null | undefined): SearchableSelectOption[] =>
    current && !options.some(option => option.value === current)
      ? [
          {
            value: current,
            label: captionFromKey(current),
            keywords: [current],
            icon: renderQuickActionIcon({ name: current, accent, size: 24 }),
          },
          ...options,
        ]
      : options;

  return (
    <Controller
      name={`quickActions.${index}.iconName`}
      control={control}
      render={({ field }) => (
        <SearchableSelect
          options={optionsWith(field.value)}
          value={field.value ?? null}
          onValueChange={field.onChange}
          label="Icon"
          labelVariant="large"
          placeholder="Select icon"
          searchPlaceholder="Search for Icon"
          emptyText="No icons found"
          layout="grid"
          align="end"
          contentClassName="w-[360px]"
          className={className}
        />
      )}
    />
  );
}
