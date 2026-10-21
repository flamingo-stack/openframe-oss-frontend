'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { Ellipsis01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  FloatingTooltip,
  Tag,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useAutoLimitTags } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo } from 'react';

export interface SelectableTag {
  id: string;
  key: string;
}

/**
 * Max characters shown on a tag chip before it is truncated with an ellipsis;
 * the full key is then surfaced via a tooltip. Keeps a single long key from
 * stretching the row (and the measured chips in sync with the visible ones).
 */
const MAX_TAG_LABEL_LENGTH = 24;

/** The row's frame, one line of chips tall (a tag chip is `h-8`): loading, loaded and empty alike. */
const ROW_CLASS = 'flex min-h-8 items-center gap-[var(--spacing-system-xxs)] overflow-hidden';

const formatTagLabel = (key: string): string =>
  key.length > MAX_TAG_LABEL_LENGTH ? `${key.slice(0, MAX_TAG_LABEL_LENGTH)}…` : key;

interface SelectableTagsRowProps {
  tags: ReadonlyArray<SelectableTag>;
  selectedIds: ReadonlyArray<string>;
  onAdd: (tag: SelectableTag) => void;
  /** The tags have not been read yet (a client read); inside a loading scope the row switches itself. */
  loading?: boolean;
}

/**
 * Single-line row of clickable tag chips for adding to a filter. Whatever does
 * not fit on one line collapses into a "…" chip that opens an actions menu of
 * the remaining tags; each caller supplies its own (already-fetched) tag list.
 */
export function SelectableTagsRow({ tags, selectedIds, onAdd, loading: loadingProp }: SelectableTagsRowProps) {
  const loading = useLoadingScope() || !!loadingProp;
  const available = useMemo(() => {
    const selected = new Set(selectedIds);
    return tags.filter(tag => !selected.has(tag.id));
  }, [tags, selectedIds]);

  const { visibleCount, middleRef, measureRef, badgeRef } = useAutoLimitTags({
    count: available.length,
    reserveInputWidth: false,
  });

  if (loading) return <SelectableTagsRowSkeleton />;
  // Nothing left to add: the row keeps its line, so the list under it does not move when the tags answer.
  if (available.length === 0) return <div className={ROW_CLASS} />;

  const visible = available.slice(0, visibleCount);
  const hidden = available.slice(visibleCount);

  return (
    <div className="relative">
      <div ref={middleRef} className={ROW_CLASS}>
        {visible.map(tag => {
          const isTruncated = tag.key.length > MAX_TAG_LABEL_LENGTH;
          return (
            <FloatingTooltip key={tag.id} content={tag.key} side="top" disabled={!isTruncated} className="break-all">
              <Tag
                data-loading-item
                variant="outline"
                // Element (not a string) so the chip doesn't also set a native `title`
                // tooltip on top of the styled one.
                label={<span>{formatTagLabel(tag.key)}</span>}
                onClick={() => onAdd(tag)}
                className="shrink-0 cursor-pointer hover:bg-ods-bg-hover"
              />
            </FloatingTooltip>
          );
        })}

        {hidden.length > 0 && (
          <ActionsMenuDropdown
            align="start"
            triggerAriaLabel={`Show ${hidden.length} more tags`}
            customTrigger={
              <button ref={badgeRef} type="button" className="shrink-0 cursor-pointer">
                <Tag
                  variant="outline"
                  label={<Ellipsis01Icon className="size-4" />}
                  className="hover:bg-ods-bg-hover"
                />
              </button>
            }
            groups={[
              // closeOnSelect: false keeps the menu open so several tags can be added in
              // one pass; the picked tag just moves up into the search box.
              {
                items: hidden.map(tag => ({
                  id: tag.id,
                  label: tag.key,
                  closeOnSelect: false,
                  onClick: () => onAdd(tag),
                })),
              },
            ]}
          />
        )}
      </div>

      {/* Off-screen copies of every available tag so useAutoLimitTags can measure widths. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 flex gap-[var(--spacing-system-xxs)]"
      >
        {available.map(tag => (
          <Tag key={tag.id} variant="outline" label={formatTagLabel(tag.key)} />
        ))}
      </div>
    </div>
  );
}

/**
 * The row while its tags are read: a typical row of tag chips (the vocabulary has no page size), each the lib's
 * `Tag` in its loading form (the chip's own frame and height) at varied widths so the placeholder reads as tags.
 */
const SKELETON_TAG_WIDTHS = ['w-16', 'w-24', 'w-20', 'w-16', 'w-28', 'w-20'];

function SelectableTagsRowSkeleton() {
  return (
    <LoadingRegion label="Loading tags" className={ROW_CLASS}>
      {SKELETON_TAG_WIDTHS.map((width, idx) => (
        <span key={idx} data-loading-item className="shrink-0">
          <Tag label="" loading className={width} />
        </span>
      ))}
    </LoadingRegion>
  );
}
