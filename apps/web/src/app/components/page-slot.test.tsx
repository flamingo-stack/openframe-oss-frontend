// Pins what the page slot draws on a landing route between the shell's hold and the page (CU-17tkuw69uzq): the
// landing skeleton while held, while the page's chunk is still loading (the page suspends) and while the device status
// gate above the page waits; never an empty slot. Any other route draws nothing while it waits, as before.

import { act, type ReactNode, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePageFallback } from './page-fallback-context';
import { PageSlot } from './page-slot';

const { mode } = vi.hoisted(() => ({ mode: { saas: true } }));

vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => mode.saas,
}));
vi.mock('@/app/(app)/mingo/home/manhattan-start-work', () => ({
  ManhattanStartWork: ({ live }: { live?: boolean }) => <p data-skeleton="start-work">{`live=${String(live)}`}</p>,
}));
vi.mock('@/app/(app)/mingo/home/mingo-new-chat', () => ({ MingoNewChat: () => <p data-skeleton="new-chat" /> }));
vi.mock('@/app/(app)/mingo/home/mingo-dashboard', () => ({
  MingoDashboard: () => <p data-skeleton="dashboard" />,
}));
vi.mock('@/app/(app)/dashboard/components/dashboard-content', () => ({
  DashboardOverviews: () => <p data-skeleton="oss-dashboard" />,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mode.saas = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

function render(pathname: string, held: boolean, page: ReactNode, manhattan = true) {
  act(() =>
    root.render(
      <PageSlot pathname={pathname} manhattan={manhattan} held={held}>
        {page}
      </PageSlot>,
    ),
  );
}

/** Shown, not merely in the DOM: a suspended boundary keeps its old content, hidden with `display: none`. */
function shown(element: Element): boolean {
  for (let node: Element | null = element; node && node !== container; node = node.parentElement)
    if (node instanceof HTMLElement && node.style.display === 'none') return false;
  return true;
}

const skeleton = () => [...container.querySelectorAll('[data-skeleton]')].find(shown) ?? null;

/** A page whose chunk never arrives within the test: it suspends for good. */
const pending = new Promise<never>(() => {});
function LoadingPage(): ReactNode {
  return use(pending);
}

/** The device status gate's shape: the shell's stand-in while it waits. */
function WaitingGate() {
  return <>{usePageFallback()}</>;
}

describe('PageSlot', () => {
  it('draws Start Work in its loading form while the shell holds Mingo’s home', () => {
    render('/mingo', true, <p data-page="" />);
    expect(skeleton()?.getAttribute('data-skeleton')).toBe('start-work');
    expect(skeleton()?.textContent).toBe('live=false');
    expect(container.querySelector('[data-page]')).toBeNull();
  });

  it('keeps the Start Work skeleton when the hold lets go while the page is still loading', () => {
    render('/mingo', true, <LoadingPage />);
    render('/mingo', false, <LoadingPage />);
    expect(skeleton()?.getAttribute('data-skeleton')).toBe('start-work');
  });

  it('gives the gate above the page the Start Work skeleton to draw while it waits', () => {
    render('/mingo/', false, <WaitingGate />);
    expect(skeleton()?.getAttribute('data-skeleton')).toBe('start-work');
  });

  it('draws the page once it can', () => {
    render('/mingo', false, <p data-page="" />);
    expect(container.querySelector('[data-page]')).not.toBeNull();
    expect(skeleton()).toBeNull();
  });

  it('draws the new chat outside Manhattan v2', () => {
    render('/mingo', false, <LoadingPage />, false);
    expect(skeleton()?.getAttribute('data-skeleton')).toBe('new-chat');
  });

  it('draws the SaaS dashboard skeleton on the dashboard', () => {
    render('/dashboard', false, <LoadingPage />);
    expect(skeleton()?.getAttribute('data-skeleton')).toBe('dashboard');
  });

  it('draws the OSS dashboard skeleton on an OSS tenant', () => {
    mode.saas = false;
    render('/dashboard', false, <WaitingGate />);
    expect(skeleton()?.getAttribute('data-skeleton')).toBe('oss-dashboard');
  });

  it('draws nothing while another route waits', () => {
    render('/devices', false, <LoadingPage />);
    expect(skeleton()).toBeNull();
    expect(container.textContent).toBe('');
    render('/devices', false, <WaitingGate />);
    expect(container.innerHTML).toBe('');
  });
});
