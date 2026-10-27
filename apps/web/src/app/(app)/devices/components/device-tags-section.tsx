'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { LoadingItems, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { Device } from '../types/device.types';

/** How many tag chips the row draws while the device is read (a typical device's tags; the list has no limit). */
const DEVICE_TAGS_SKELETON_COUNT = 3;

/** The chip row: at least one chip's height, so the bars take the row the chips take. */
const TAGS_ROW_CLASS = 'flex min-h-8 flex-wrap items-center gap-2';

interface DeviceTagsSectionProps {
  device: Device | null;
}

/**
 * "Device Tags" section for the device Overview tab — renders the device's
 * key:value tags as chips. Chip bars while the device is read; once it is read,
 * a device with no tags has no section.
 */
export function DeviceTagsSection({ device }: DeviceTagsSectionProps) {
  const loading = useLoadingScope();
  const tagValues =
    device?.tags?.flatMap(tag => tag.values.map(value => ({ id: `${tag.tagId}-${value}`, key: tag.key, value }))) ?? [];

  if (!loading && tagValues.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-s)]">
      <p className="text-ods-text-secondary text-h5">Device Tags</p>
      <div className={TAGS_ROW_CLASS}>
        {loading ? (
          <LoadingItems count={DEVICE_TAGS_SKELETON_COUNT}>
            {() => <Tag as="span" variant="badge" label="" loading data-loading-item />}
          </LoadingItems>
        ) : (
          tagValues.map(tag => (
            // `badge` is the DS tag-badge skin (ods-card + border, mono uppercase); the string
            // label gives a native `title` tooltip on hover, so no extra Tooltip plumbing needed.
            <Tag key={tag.id} as="span" variant="badge" label={`${tag.key}:${tag.value}`} data-loading-item />
          ))
        )}
      </div>
    </div>
  );
}
