'use client';

import { Autocomplete, type AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useDeferredValue, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type {
  installSoftwarePackageSearchRelayQuery$data,
  installSoftwarePackageSearchRelayQuery as PackageSearchQueryType,
} from '@/__generated__/installSoftwarePackageSearchRelayQuery.graphql';
import { BrewPackageType, type PackageManagerType } from '@/generated/schema-enums';
import { installSoftwarePackageSearchRelayQuery } from '@/graphql/software/install-software-package-search-relay';

/** Below this many characters (after trimming) the catalog is not searched. */
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 25;
const LABEL = 'Software Name';
const PLACEHOLDER = 'Search for Software';

type SearchItem = NonNullable<installSoftwarePackageSearchRelayQuery$data['searchPackages']>['edges'][number]['node'];

/** A catalog package the user picked — kept whole so the row can show its description and version. */
export interface SelectedPackage {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  packageType: BrewPackageType | null;
}

function toSelectedPackage(item: SearchItem): SelectedPackage {
  const knownTypes = Object.values(BrewPackageType) as string[];
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    version: item.version ?? null,
    packageType:
      item.packageType && knownTypes.includes(item.packageType) ? (item.packageType as BrewPackageType) : null,
  };
}

/**
 * Homebrew publishes a formula and a cask under the same name (`docker`, say),
 * so the id alone does not identify an option.
 */
function packageKey(pkg: SelectedPackage): string {
  return `${pkg.packageType ?? ''}:${pkg.id}`;
}

function toOption(pkg: SelectedPackage): AutocompleteOption {
  return { value: packageKey(pkg), label: pkg.name, description: pkg.description ?? undefined };
}

interface PackageSearchFieldProps {
  packageManager: PackageManagerType;
  value: SelectedPackage | null;
  onChange: (pkg: SelectedPackage | null) => void;
}

/**
 * "Software Name": a server-searched picker over one package manager's catalog.
 *
 * The query variables are deferred, so a new search keeps the previous results
 * on screen (and the input focused) while it is in flight instead of suspending
 * the field. Below two characters the search field is not selected at all and
 * the read is `store-only` — no request, no suspension.
 *
 * Callers key it by package manager: switching catalogs starts a fresh search.
 */
export function PackageSearchField({ packageManager, value, onChange }: PackageSearchFieldProps) {
  const [search, setSearch] = useState('');
  const query = useDebounce(search, 300).trim();
  const deferredQuery = useDeferredValue(query);
  const hasQuery = deferredQuery.length >= MIN_QUERY_LENGTH;

  const data = useLazyLoadQuery<PackageSearchQueryType>(
    installSoftwarePackageSearchRelayQuery,
    { packageManager, search: deferredQuery, first: SEARCH_LIMIT, hasQuery },
    { fetchPolicy: hasQuery ? 'store-or-network' : 'store-only' },
  );

  const typedEnough = search.trim().length >= MIN_QUERY_LENGTH;
  const isSearching = typedEnough && (search.trim() !== query || deferredQuery !== query);

  const found = (data.searchPackages?.edges ?? []).map(edge => toSelectedPackage(edge.node));
  // The picked package must stay resolvable after the results move on to a new search.
  const known = value && !found.some(pkg => packageKey(pkg) === packageKey(value)) ? [value, ...found] : found;

  return (
    <Autocomplete
      label={LABEL}
      labelVariant="large"
      options={known.map(toOption)}
      value={value ? packageKey(value) : null}
      onChange={key => onChange(known.find(pkg => packageKey(pkg) === key) ?? null)}
      onInputChange={(next, reason) => {
        if (reason !== 'reset') setSearch(next);
      }}
      disableClientFilter
      placeholder={PLACEHOLDER}
      loading={isSearching}
      noOptionsText={typedEnough ? 'No packages found' : `Type at least ${MIN_QUERY_LENGTH} characters`}
    />
  );
}

/** The field while it cannot search: the first read in flight, or the search failed. */
export function PackageSearchFieldPlaceholder({ error }: { error?: string }) {
  return (
    <Autocomplete
      label={LABEL}
      labelVariant="large"
      options={[]}
      value={null}
      onChange={() => {}}
      placeholder={PLACEHOLDER}
      disabled
      error={error}
      invalid={!!error}
    />
  );
}
