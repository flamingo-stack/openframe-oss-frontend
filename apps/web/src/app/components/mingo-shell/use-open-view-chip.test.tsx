import { act, type ReactNode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoContextStore } from '@/app/(app)/mingo/stores/mingo-context-store';
import type { ComposerRoute } from './mingo-dock-route';
import { useOpenViewChip } from './use-open-view-chip';

interface StripProps {
  items: Array<{ type: string; id: string; label: string }>;
  onRemove: (item: { type: string; id: string }) => void;
}
const strip = { props: null as StripProps | null };

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  ChatContextChipStrip: (props: StripProps) => {
    strip.props = props;
    return <span>{props.items[0]?.label}</span>;
  },
}));
// The picker's kinds, as far as the chip reads them; INSIGHT stands for a kind whose module is off.
vi.mock('@/app/(app)/mingo/context/context-sources', () => ({
  useMingoContextEntityTypes: () => [
    { type: 'ORGANIZATION', label: 'Customer', icon: null },
    { type: 'DEVICE', label: 'Device', icon: null },
  ],
}));

const probe = { node: null as ReactNode };
function Harness({ route }: { route: ComposerRoute }) {
  const node = useOpenViewChip(route);
  useEffect(() => {
    probe.node = node;
  });
  return <>{node}</>;
}

let container: HTMLDivElement;
let root: Root;
const render = (route: ComposerRoute) => act(() => root.render(<Harness route={route} />));

describe('useOpenViewChip', () => {
  beforeEach(() => {
    strip.props = null;
    useMingoContextStore.setState({ openView: null, recentViews: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("names the page's entity, kind first, on a page", () => {
    useMingoContextStore.setState({ openView: { type: 'ORGANIZATION', id: 'o-1', label: 'Default' } });
    for (const route of ['page', 'full-width'] as const) {
      render(route);
      expect(container.textContent).toBe('Customer: Default');
    }
  });

  it('shows nothing on a list page, on home or on the chat page', () => {
    render('page');
    expect(probe.node).toBeNull();
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'd-1', label: 'MacBook' } });
    for (const route of ['home', 'chat'] as const) {
      render(route);
      expect(probe.node).toBeNull();
    }
  });

  it('shows nothing for a kind whose module is off', () => {
    useMingoContextStore.setState({ openView: { type: 'INSIGHT', id: 'i-1', label: 'Disk low' } });
    render('page');
    expect(probe.node).toBeNull();
  });

  it("takes the entity out of Mingo's context with its ×", () => {
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'd-1', label: 'MacBook' } });
    render('page');
    act(() => strip.props?.onRemove({ type: 'DEVICE', id: 'd-1' }));
    expect(useMingoContextStore.getState().openView).toBeNull();
    expect(probe.node).toBeNull();
  });
});
