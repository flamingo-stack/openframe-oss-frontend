import { act, type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoContextStore } from '@/app/(app)/mingo/stores/mingo-context-store';
import type { ComposerRoute } from './mingo-dock-route';
import { PAGE_OVERVIEW_PROMPT, usePageChip } from './use-page-chip';

interface StripItem {
  type: string;
  id: string;
  label: string;
}
interface StripProps {
  items: StripItem[];
  onRemove?: (item: StripItem) => void;
  onSelect?: (item: StripItem) => void;
}
const strips: StripProps[] = [];

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  ChatContextChipStrip: (props: StripProps) => {
    strips.push(props);
    return <span>{props.items[0]?.label}|</span>;
  },
}));
// The picker's kinds, as far as the chip reads them; INSIGHT stands for a kind whose module is off.
vi.mock('@/app/(app)/mingo/context/context-sources', () => ({
  MINGO_CONTEXT_ENTITY_TYPES: [
    { type: 'ORGANIZATION', label: 'Customer' },
    { type: 'DEVICE', label: 'Device' },
  ],
  useMingoContextEntityTypes: () => [
    { type: 'ORGANIZATION', label: 'Customer', icon: null },
    { type: 'DEVICE', label: 'Device', icon: null },
  ],
}));
const location = { pathname: '/devices/', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

const onAsk = vi.fn();
const onAddContext = vi.fn();
const probe = { node: null as ReactNode };
function Harness({ route }: { route: ComposerRoute }) {
  const node = usePageChip(route, { onAsk, onAddContext });
  useEffect(() => {
    probe.node = node;
  });
  return <>{node}</>;
}

let container: HTMLDivElement;
let root: Root;
const render = (route: ComposerRoute, pathname = '/devices/', search = '') => {
  location.pathname = pathname;
  location.search = search;
  strips.length = 0;
  act(() => root.render(<Harness route={route} />));
};
const lastStrip = () => strips.at(-1);
/** Clicks the last drawn chip, as its face button does. */
const clickChip = () => {
  const strip = lastStrip();
  if (strip?.items[0]) strip.onSelect?.(strip.items[0]);
};

describe('usePageChip', () => {
  beforeEach(() => {
    onAsk.mockReset();
    onAddContext.mockReset();
    useMingoContextStore.setState({ openView: null, recentViews: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('names the page as Mingo is told it, on a list and in the settings', () => {
    render('page', '/devices/', 'statuses=OFFLINE');
    expect(container.textContent).toBe('Devices|');
    render('page', '/settings/', 'tab=api-keys');
    expect(container.textContent).toBe('Settings|');
    render('page', '/approvals/');
    expect(container.textContent).toBe('Needs approval|');
    render('page', '/mingo/archive/');
    expect(container.textContent).toBe('Chat Archive|');
  });

  it('asks Mingo for an overview of the page on a click', () => {
    render('page');
    act(() => clickChip());
    expect(onAsk).toHaveBeenCalledWith(PAGE_OVERVIEW_PROMPT);
  });

  it("gives the page's own chip no ×: the page is always sent", () => {
    render('page');
    expect(lastStrip()?.onRemove).toBeUndefined();
  });

  it('adds "Add context" on home, which opens the picker', () => {
    render('home', '/mingo/');
    expect(container.textContent).toBe('Home|Add context|');
    act(() => clickChip());
    expect(onAddContext).toHaveBeenCalled();
    expect(onAsk).not.toHaveBeenCalled();
  });

  it("names the page's entity, kind first, on its page", () => {
    useMingoContextStore.setState({ openView: { type: 'ORGANIZATION', id: 'o-1', label: 'Default' } });
    for (const route of ['page', 'full-width'] as const) {
      render(route, '/customers/details/', 'id=o-1');
      expect(container.textContent).toBe('Customer: Default|');
    }
    act(() => clickChip());
    expect(onAsk).toHaveBeenCalledWith(PAGE_OVERVIEW_PROMPT);
  });

  it('names the page by its kind for an entity whose module is off, or before it lands', () => {
    useMingoContextStore.setState({ openView: { type: 'INSIGHT', id: 'i-1', label: 'Disk low' } });
    render('page', '/customers/details/', 'id=o-1');
    expect(container.textContent).toBe('Customer|');
  });

  it("takes the entity out of Mingo's context with its ×", () => {
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'd-1', label: 'MacBook' } });
    render('page', '/devices/details/', 'id=d-1');
    act(() => lastStrip()?.onRemove?.({ type: 'DEVICE', id: 'd-1', label: 'MacBook' }));
    expect(useMingoContextStore.getState().openView).toBeNull();
    expect(container.textContent).toBe('Device|');
  });

  it('shows nothing on the chat page', () => {
    render('chat', '/mingo/chat/', 'id=d-1');
    expect(probe.node).toBeNull();
  });
});
