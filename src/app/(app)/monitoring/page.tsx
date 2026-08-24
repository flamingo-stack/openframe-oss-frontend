'use client';

import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { MonitoringTabNavigation } from './components/tabs/monitoring-tabs';
import { Policies } from './components/tabs/policies';
import { Queries } from './components/tabs/queries';

export default function Monitoring() {
  // `tab` and `search` live here so the page is the ONLY writer of the URL. When
  // each tab owned its own `search` param, that second `useApiParams` wrote the
  // URL from its own snapshot, which still carried the previous `tab` — so a
  // search write landing after a tab switch reasserted the old tab and flipped
  // the page back to the `policies` default. One writer removes that race.
  const { params, setParams } = useApiParams({
    tab: { type: 'string', default: 'policies' },
    search: { type: 'string', default: '' },
  });

  const { search, setSearch, debouncedSearch } = useSearchParam(
    params.search,
    value => setParams({ search: value }),
    300,
  );

  const isQueries = params.tab === 'queries';

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col w-full">
        <MonitoringTabNavigation
          activeTab={params.tab}
          onTabChange={tab => {
            // Clear the input now and the URL param together, so the new tab
            // opens with an empty search instead of inheriting the old one.
            setSearch('');
            setParams({ tab, search: '' });
          }}
        />
        {/* A failed Fleet query takes out this region only — the tabs above and
            the app shell survive. `resetKey` clears a tripped boundary when the
            user switches tabs. */}
        <ContentErrorBoundary
          resetKey={params.tab}
          title={isQueries ? 'Queries' : 'Policies'}
          message={isQueries ? "Couldn't load queries." : "Couldn't load policies."}
        >
          {isQueries ? (
            <Queries search={search} debouncedSearch={debouncedSearch} onSearchChange={setSearch} />
          ) : (
            <Policies search={search} debouncedSearch={debouncedSearch} onSearchChange={setSearch} />
          )}
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
