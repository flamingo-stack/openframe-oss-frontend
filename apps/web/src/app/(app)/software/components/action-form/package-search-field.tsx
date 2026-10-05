'use client';

import { Autocomplete, type AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useDeferredValue, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  packageSearchFieldQuery$data,
  packageSearchFieldQuery as PackageSearchFieldQueryType,
} from '@/__generated__/packageSearchFieldQuery.graphql';
import { BrewPackageType, type PackageManagerType } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { PACKAGE_SEARCH_LABEL, PACKAGE_SEARCH_PLACEHOLDER } from './package-search-field-placeholder';

/**
 * Package-manager catalog search (Homebrew / Chocolatey / winget). An empty search lists the
 * catalog (Homebrew: most popular first), so the field has options before the user types.
 *
 * `@include(if: $list)` is off for the first render only: read `store-only`, that paints the
 * field without a request, and the listing itself arrives in the deferred re-render below.
 */
const packageSearchFieldQuery = graphql`
  query packageSearchFieldQuery($packageManager: PackageManagerType!, $search: String!, $first: Int!, $list: Boolean!) {
    searchPackages(packageManager: $packageManager, search: $search, first: $first) @include(if: $list) {
      edges {
        node {
          id
          name
          description
          version
          packageType
        }
      }
    }
  }
`;

const SEARCH_LIMIT = 25;
/** The deferred query's first-render value: no search yet, not even the empty one. */
const NOT_YET = null;

type SearchItem = NonNullable<packageSearchFieldQuery$data['searchPackages']>['edges'][number]['node'];

/** A catalog package the user picked — kept whole so the row can show its description and version. */
export interface SelectedPackage {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  packageType: BrewPackageType | null;
}

function toSelectedPackage(item: SearchItem): SelectedPackage {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    version: item.version ?? null,
    packageType: knownValue(BrewPackageType, item.packageType),
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
 * The query variables are deferred, so a search never suspends the field: the
 * input stays mounted and focused while the fetch is in flight, and the list
 * shows the picker's loading row until the results land. The very first value is `NOT_YET` (React 19 `initialValue`), so the
 * opening listing of the catalog is a deferred re-render too: the field is live
 * and typeable from the first paint, never the disabled placeholder, and a query
 * typed meanwhile simply supersedes it.
 *
 * Callers key it by package manager: switching catalogs starts a fresh search.
 */
export function PackageSearchField({ packageManager, value, onChange }: PackageSearchFieldProps) {
  const [search, setSearch] = useState('');
  const query = useDebounce(search, 300).trim();
  const deferredQuery = useDeferredValue<string | null>(query, NOT_YET);
  const list = deferredQuery !== NOT_YET;

  const data = useLazyLoadQuery<PackageSearchFieldQueryType>(
    packageSearchFieldQuery,
    { packageManager, search: deferredQuery ?? '', first: SEARCH_LIMIT, list },
    { fetchPolicy: list ? 'store-or-network' : 'store-only' },
  );

  const isSearching = !list || search.trim() !== query || deferredQuery !== query;

  const found = (data.searchPackages?.edges ?? []).map(edge => toSelectedPackage(edge.node));
  // The picked package must stay resolvable after the results move on to a new search.
  const known = value && !found.some(pkg => packageKey(pkg) === packageKey(value)) ? [value, ...found] : found;

  return (
    <Autocomplete
      label={PACKAGE_SEARCH_LABEL}
      labelVariant="large"
      options={known.map(toOption)}
      value={value ? packageKey(value) : null}
      onChange={key => onChange(known.find(pkg => packageKey(pkg) === key) ?? null)}
      onInputChange={(next, reason) => {
        if (reason !== 'reset') setSearch(next);
      }}
      disableClientFilter
      placeholder={PACKAGE_SEARCH_PLACEHOLDER}
      loading={isSearching}
      noOptionsText="No packages found"
    />
  );
}
