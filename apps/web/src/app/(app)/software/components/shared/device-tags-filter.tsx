'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter02Icon, TagIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, FilterModal, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { deviceTagsFilterQuery as DeviceTagsFilterQueryType } from '@/__generated__/deviceTagsFilterQuery.graphql';
import { rawIdOfType } from '@/lib/relay-id';

/** The tenant's device tags (keys): what a Software list's `deviceTagIds` narrows by. */
const deviceTagsFilterQuery = graphql`
  query deviceTagsFilterQuery {
    tags {
      id
      key
    }
  }
`;

const TITLE = 'Device Tags';
const GROUP_ID = 'deviceTags';

interface DeviceTagsFilterProps {
  /** The ticked tags, by raw id: the backend matches `deviceTagIds` against the stored tag id, not the global one. */
  value: readonly string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

/**
 * The Device Tags button beside a Software list's search (designs 1100:444, 1051:15572): a window of the tenant's tags,
 * a device matching when it carries any ticked one. Labelled from the content area's md step; below it the tag glyph
 * alone, apart from the funnel of a list's own filter button. The tags are read when the window opens.
 */
export function DeviceTagsFilter({ value, onChange, disabled = false }: DeviceTagsFilterProps) {
  const [open, setOpen] = useState(false);
  const label = value.length > 0 ? `${TITLE} (${value.length})` : TITLE;
  const show = () => setOpen(true);
  return (
    <>
      <Button
        variant="outline"
        onClick={show}
        disabled={disabled}
        leftIcon={<Filter02Icon className="text-ods-text-secondary" />}
        className="hidden shrink-0 content-md:inline-flex"
      >
        {label}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={label}
        onClick={show}
        disabled={disabled}
        // The tag, not the funnel: below md a list's own filter button sits beside it with the funnel.
        leftIcon={<TagIcon className="text-ods-text-primary" />}
        className="shrink-0 content-md:hidden"
      />
      {open && <DeviceTagsWindow value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

interface DeviceTagsWindowProps {
  value: readonly string[];
  onChange: (tagIds: string[]) => void;
  onClose: () => void;
}

const NO_GROUPS: never[] = [];
const IGNORE = () => {};

/** The window, with its own boundary: in its loading form while the tags are read. */
function DeviceTagsWindow(props: DeviceTagsWindowProps) {
  return (
    <LoadingSuspense label="Loading device tags">
      <DeviceTagsWindowReader {...props} />
    </LoadingSuspense>
  );
}

function DeviceTagsWindowReader(props: DeviceTagsWindowProps) {
  if (useLoadingScope()) {
    return (
      <FilterModal
        isOpen
        isLoading
        title={TITLE}
        onClose={props.onClose}
        filterGroups={NO_GROUPS}
        onFilterChange={IGNORE}
      />
    );
  }
  return <DeviceTagsWindowQuery {...props} />;
}

function DeviceTagsWindowQuery({ value, onChange, onClose }: DeviceTagsWindowProps) {
  const data = useLazyLoadQuery<DeviceTagsFilterQueryType>(
    deviceTagsFilterQuery,
    {},
    { fetchPolicy: 'store-and-network' },
  );
  const options = data.tags.map(tag => ({ id: rawIdOfType('Tag', tag.id), label: tag.key }));
  return (
    <FilterModal
      isOpen
      title={TITLE}
      onClose={onClose}
      filterGroups={[{ id: GROUP_ID, title: 'Tags', options }]}
      currentFilters={{ [GROUP_ID]: [...value] }}
      onFilterChange={filters => onChange((filters[GROUP_ID] as string[] | undefined) ?? [])}
    />
  );
}
