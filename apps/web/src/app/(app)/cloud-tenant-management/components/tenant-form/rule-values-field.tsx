'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Autocomplete,
  type AutocompleteOption,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useDeferredValue, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { ruleValuesFieldQuery as RuleValuesFieldQueryType } from '@/__generated__/ruleValuesFieldQuery.graphql';
import { ContentErrorBoundary, SectionLoadError, noop, useRetryKey } from '@/app/components/shared';
import { DirectoryRuleKind } from '@/generated/schema-enums';
import { ruleKindPlural, ruleValueLabel } from '../../utils/tenant-presentation';
import type { RuleValue } from './attribution.types';

// The Values picker of one rule (Figma 3562-27507): the directory's domains, groups or org units,
// searched by name on the server. Until the connection's first sync has finished the API reads
// them live from the provider, so a tenant connected a minute ago can be split already.

/** The API's default page; a longer list is narrowed by typing. */
const OPTIONS_LIMIT = 50;

const ruleValuesFieldQuery = graphql`
  query ruleValuesFieldQuery($connectionId: ID!, $kind: DirectoryRuleKind!, $search: String, $first: Int) {
    directoryRuleOptions(connectionId: $connectionId, kind: $kind, search: $search, first: $first) {
      id
      name
    }
  }
`;

const PLACEHOLDER = 'Select Value';

interface RuleValuesFieldProps {
  connectionId: string;
  /** `''` until "Match by" is picked; `ALL` takes no values. */
  kind: DirectoryRuleKind | '';
  value: readonly RuleValue[];
  onChange: (value: RuleValue[]) => void;
  /** Only the first rule of a customer carries the column labels (Figma 3562-27507). */
  label?: string;
  error?: string;
  /** The values the connection's other rules of this kind hold: a value belongs to one rule per connection. */
  exclude?: ReadonlySet<string>;
  /** The block waits for its directory: there is nothing to read yet. */
  locked?: boolean;
  /** A write is in flight: the field stays mounted, inert, so its search and a retried read survive the save. */
  disabled?: boolean;
}

type RuleValuesOptionsProps = Omit<RuleValuesFieldProps, 'kind' | 'locked'> & { kind: DirectoryRuleKind };

function toOption(value: RuleValue): AutocompleteOption<string> {
  return { value: value.id, label: ruleValueLabel(value) };
}

/** The field with nothing to search: no kind yet, `ALL`, locked, or the list could not be read. */
function LockedValues({
  value,
  label,
  error,
  placeholder = PLACEHOLDER,
}: Pick<RuleValuesFieldProps, 'value' | 'label' | 'error'> & { placeholder?: string }) {
  return (
    <Autocomplete
      multiple
      label={label}
      labelVariant="large"
      options={value.map(toOption)}
      value={value.map(item => item.id)}
      onChange={noop}
      placeholder={placeholder}
      error={error}
      invalid={!!error}
      disabled
    />
  );
}

function RuleValuesOptions({
  connectionId,
  kind,
  value,
  onChange,
  label,
  error,
  exclude,
  disabled,
}: RuleValuesOptionsProps) {
  const retryKey = useRetryKey();
  const [input, setInput] = useState('');
  const debounced = useDebounce(input.trim(), 300);
  // A new search re-suspends the query: deferred, the open list keeps the last answer until the next one lands.
  const search = useDeferredValue(debounced);
  const { directoryRuleOptions } = useLazyLoadQuery<RuleValuesFieldQueryType>(
    ruleValuesFieldQuery,
    { connectionId, kind, search: search || null, first: OPTIONS_LIMIT },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  // The picked values stay named after the search moves on; a fresh answer renames them.
  const byId = new Map<string, RuleValue>(value.map(item => [item.id, item]));
  for (const option of directoryRuleOptions) byId.set(option.id, { id: option.id, name: option.name ?? null });
  // Another rule's values are not offered; one this rule already holds stays, so the form can say where it clashes.
  const picked = new Set(value.map(item => item.id));
  const offered = [...byId.values()].filter(item => picked.has(item.id) || !exclude?.has(item.id));

  return (
    <Autocomplete
      multiple
      label={label}
      labelVariant="large"
      options={offered.map(toOption)}
      value={value.map(item => item.id)}
      onChange={ids => onChange(ids.map(id => byId.get(id) ?? { id, name: null }))}
      onInputChange={setInput}
      disableClientFilter
      loading={input.trim() !== search}
      placeholder={PLACEHOLDER}
      noOptionsText={`No ${ruleKindPlural(kind)} match`}
      error={error}
      invalid={!!error}
      disabled={disabled}
    />
  );
}

/**
 * The Values field. Locked while there is nothing to search (no kind, `ALL`, or `locked`); otherwise it reads the
 * directory's values under its own boundary, so a provider that cannot be reached costs this field, not the form.
 */
export function RuleValuesField({ kind, locked = false, ...props }: RuleValuesFieldProps) {
  if (kind === DirectoryRuleKind.ALL) {
    return <LockedValues {...props} placeholder="Every account" />;
  }
  if (!kind || locked) {
    return <LockedValues {...props} />;
  }
  return (
    <ContentErrorBoundary
      // A failed read is one kind's: another "Match by" asks the directory again.
      resetKey={kind}
      fallback={retry => (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <LockedValues {...props} />
          <SectionLoadError message={`Couldn't read the ${ruleKindPlural(kind)} from the directory.`} onRetry={retry} />
        </div>
      )}
    >
      <LoadingSuspense label="Loading values">
        <RuleValuesBody {...props} kind={kind} />
      </LoadingSuspense>
    </ContentErrorBoundary>
  );
}

/** In a loading scope (its own Suspense fallback, or the page's) the field draws its own skeleton and reads nothing. */
function RuleValuesBody(props: RuleValuesOptionsProps) {
  if (useLoadingScope()) {
    return <LockedValues {...props} />;
  }
  return <RuleValuesOptions {...props} />;
}
