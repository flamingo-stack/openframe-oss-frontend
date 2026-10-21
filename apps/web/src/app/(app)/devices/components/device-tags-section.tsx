'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { LoadingItems, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EmptyValue } from '@/app/components/shared/empty-value';
import type { Device } from '../types/device.types';

/** How many tag chips the row draws while the device is read (a typical device's tags; the list has no limit). */
const DEVICE_TAGS_SKELETON_COUNT = 3;

/** The chip row: at least one chip's height, so the empty mark and the bars take the row the chips take. */
const TAGS_ROW_CLASS = 'flex min-h-8 flex-wrap items-center gap-2';

interface DeviceTagsSectionProps {
  device: Device | null;
}

/**
 * "Device Tags" section for the device Overview tab — renders the device's
 * key:value tags as chips. The section sits in the first screen, so it is always
 * drawn: chip bars while the device is read, the empty mark when it has no tags.
 */
export function DeviceTagsSection({ device }: DeviceTagsSectionProps) {
  const loading = useLoadingScope();
  const tagValues =
    device?.tags?.flatMap(tag => tag.values.map(value => ({ id: `${tag.tagId}-${value}`, key: tag.key, value }))) ?? [];

  return (
    <div className="flex flex-col gap-[var(--spacing-system-s)]">
      <p className="text-ods-text-secondary text-h5">Device Tags</p>
      <div className={TAGS_ROW_CLASS}>
        {loading ? (
          <LoadingItems count={DEVICE_TAGS_SKELETON_COUNT}>
            {() => <Tag as="span" variant="badge" label="" loading data-loading-item />}
          </LoadingItems>
        ) : tagValues.length === 0 ? (
          <span className="text-h4">
            <EmptyValue />
          </span>
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
