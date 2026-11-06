/**
 * Which tree each tenant page draws. Phase 1 (`tenant-management`) still owns the module's 404. Phase 2 picks the
 * views: TM2's only while both flags are on, main's (`v1/`) otherwise, and main's in its loading scope until the
 * flags answer, since stage and prod run with phase 2 off. Disconnect and Delete exist only in TM2, so they 404
 * unless both flags are on. The views are stubs that say which one rendered and whether it was told to wait.
 */

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const url = vi.hoisted(() => ({ search: '' }));
const notFound = vi.hoisted(() => vi.fn());

const stubView = vi.hoisted(() => (name: string) => () => {
  function View({ loading }: { loading?: boolean }) {
    const scoped = useLoadingScope();
    return <p>{`${name} loading=${String(loading ?? scoped)}`}</p>;
  }
  return { [name]: View };
});

// Vitest runs no Relay Babel transform, and the page shell's shared barrel declares `graphql` tags at module scope,
// which would throw on import. Nothing here reads them.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

vi.mock('next/navigation', () => ({
  notFound,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cloud-tenant-management',
  useSearchParams: () => new URLSearchParams(url.search),
}));

vi.mock('./components/tenant-list/tenant-list-view', stubView('TenantListView'));
vi.mock('./components/v1/tenant-list/tenant-list-view-v1', stubView('TenantListViewV1'));
vi.mock('./components/tenant-detail/tenant-detail-view', stubView('TenantDetailView'));
vi.mock('./components/v1/tenant-detail/tenant-detail-view-v1', stubView('TenantDetailViewV1'));
vi.mock('./components/tenant-edit/edit-tenant-view', stubView('EditTenantView'));
vi.mock('./components/v1/tenant-edit/edit-tenant-view-v1', stubView('EditTenantViewV1'));
vi.mock('./components/tenant-new/new-tenant-view', stubView('NewTenantView'));
vi.mock('./components/v1/tenant-new/new-tenant-view-v1', stubView('NewTenantViewV1'));
vi.mock('./components/tenant-new/connect-tenant-view', stubView('ConnectTenantView'));
vi.mock('./components/v1/tenant-new/connect-tenant-view-v1', stubView('ConnectTenantViewV1'));
vi.mock('./components/tenant-reconnect/reconnect-tenant-view', stubView('ReconnectTenantView'));
vi.mock('./components/v1/tenant-reconnect/reconnect-tenant-view-v1', stubView('ReconnectTenantViewV1'));
vi.mock('./components/tenant-end/end-connection-view', stubView('EndConnectionView'));

import DeleteConnectionPage from './delete/page';
import TenantDetailsPage from './details/page';
import DisconnectTenantPage from './disconnect/page';
import EditTenantPage from './edit/page';
import NewTenantPage from './new/page';
import TenantManagementPage from './page';
import ReconnectTenantPage from './reconnect/page';

let container: HTMLDivElement;
let root: Root;

/** `null`: the flags query has not answered yet. */
function setFlags(answer: { phase1: boolean; phase2: boolean } | null) {
  const store = useFeatureFlagsStore.getState();
  store.reset();
  if (answer) {
    store.setFlags([
      { name: 'tenant-management', enabled: answer.phase1 },
      { name: 'tenant-management-v2', enabled: answer.phase2 },
    ]);
  }
}

function render(Page: () => ReactNode) {
  act(() => {
    root.render(<Page />);
  });
  return container.textContent;
}

beforeEach(() => {
  notFound.mockReset();
  url.search = '';
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  useFeatureFlagsStore.getState().reset();
});

describe.each([
  { page: 'list', Page: TenantManagementPage, search: '', on: 'TenantListView', off: 'TenantListViewV1' },
  { page: 'details', Page: TenantDetailsPage, search: 'id=c-1', on: 'TenantDetailView', off: 'TenantDetailViewV1' },
  { page: 'edit', Page: EditTenantPage, search: 'id=c-1', on: 'EditTenantView', off: 'EditTenantViewV1' },
  { page: 'new', Page: NewTenantPage, search: '', on: 'NewTenantView', off: 'NewTenantViewV1' },
  { page: 'connect step', Page: NewTenantPage, search: 'id=c-1', on: 'ConnectTenantView', off: 'ConnectTenantViewV1' },
  {
    page: 'reconnect',
    Page: ReconnectTenantPage,
    search: 'id=c-1',
    on: 'ReconnectTenantView',
    off: 'ReconnectTenantViewV1',
  },
])('the $page page', ({ Page, search, on, off }) => {
  beforeEach(() => {
    url.search = search;
  });

  it('draws TM2 while both flags are on', () => {
    setFlags({ phase1: true, phase2: true });
    expect(render(Page)).toBe(`${on} loading=false`);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("draws main's view while tenant-management-v2 is off", () => {
    setFlags({ phase1: true, phase2: false });
    expect(render(Page)).toBe(`${off} loading=false`);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("draws main's view in its loading scope until the flags answer, and never 404s then", () => {
    setFlags(null);
    expect(render(Page)).toBe(`${off} loading=true`);
    expect(notFound).not.toHaveBeenCalled();
  });

  it('404s while tenant-management is off', () => {
    setFlags({ phase1: false, phase2: true });
    render(Page);
    expect(notFound).toHaveBeenCalled();
  });
});

describe.each([
  { page: 'disconnect', Page: DisconnectTenantPage },
  { page: 'delete', Page: DeleteConnectionPage },
])('the $page page', ({ Page }) => {
  beforeEach(() => {
    url.search = 'id=c-1';
  });

  it('draws while both flags are on', () => {
    setFlags({ phase1: true, phase2: true });
    expect(render(Page)).toBe('EndConnectionView loading=false');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('404s while tenant-management-v2 is off', () => {
    setFlags({ phase1: true, phase2: false });
    render(Page);
    expect(notFound).toHaveBeenCalled();
  });

  it('draws in its loading scope until the flags answer, and never 404s then', () => {
    setFlags(null);
    expect(render(Page)).toBe('EndConnectionView loading=true');
    expect(notFound).not.toHaveBeenCalled();
  });
});
