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
 * Package-manager catalog search (Homebrew / winget).
 *
 * `@include(if: $hasQuery)`: the backend rejects a search under 2 characters,
 * so the box selects nothing until then — read with `store-only`, that renders
 * without a request.
 */
const packageSearchFieldQuery = graphql`
  query packageSearchFieldQuery(
    $packageManager: PackageManagerType!
    $search: String!
    $first: Int!
    $hasQuery: Boolean!
  ) {
    searchPackages(packageManager: $packageManager, search: $search, first: $first) @include(if: $hasQuery) {
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

/** Below this many characters (after trimming) the catalog is not searched — the backend's own minimum. */
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 25;

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

  const data = useLazyLoadQuery<PackageSearchFieldQueryType>(
    packageSearchFieldQuery,
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
      noOptionsText={typedEnough ? 'No packages found' : `Type at least ${MIN_QUERY_LENGTH} characters`}
    />
  );
}
