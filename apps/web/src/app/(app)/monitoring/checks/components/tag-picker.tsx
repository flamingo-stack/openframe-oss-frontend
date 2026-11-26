'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { type AutocompleteOption, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tagPickerQuery as TagPickerQueryType } from '@/__generated__/tagPickerQuery.graphql';
import { ContentErrorBoundary, NO_ITEMS } from '@/app/components/shared';
import { type EntityPickerProps, PickerField } from './picker-field';

/** The device tags a TAG exception is picked from. The API resolves a tag scope by `Tag.id` and refuses any other tag. */
const tagPickerQuery = graphql`
  query tagPickerQuery {
    tagsByEntityType(entityType: DEVICE) {
      id
      key
    }
  }
`;

/** The device tag a TAG exception is for. */
export function TagPicker(props: EntityPickerProps) {
  return (
    <ContentErrorBoundary
      fallback={() => <PickerField {...props} options={NO_ITEMS} error="Couldn't load tags" disabled />}
    >
      <TagPickerIsland {...props} />
    </ContentErrorBoundary>
  );
}

function TagPickerIsland(props: EntityPickerProps) {
  return (
    <LoadingSuspense label="Loading tags">
      <TagPickerReader {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope it is the field, locked, reading nothing. */
function TagPickerReader(props: EntityPickerProps) {
  if (useLoadingScope()) return <PickerField {...props} options={NO_ITEMS} disabled loading />;
  return <TagPickerLive {...props} />;
}

function TagPickerLive(props: EntityPickerProps) {
  const data = useLazyLoadQuery<TagPickerQueryType>(tagPickerQuery, {}, { fetchPolicy: 'store-and-network' });
  const options = useMemo<AutocompleteOption[]>(
    () => data.tagsByEntityType.map(tag => ({ value: tag.id, label: tag.key })),
    [data.tagsByEntityType],
  );
  return <PickerField {...props} options={options} />;
}
