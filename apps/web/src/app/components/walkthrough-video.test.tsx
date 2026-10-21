/**
 * The walkthrough card's clearance variables (the dock's height, the sidebar's width)
 * live on the card's own wrapper, never on `<html>`: a custom property on the root
 * restyles every element in the document, and the dock's changes with every new line
 * of a draft.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pathname: '/devices' }));

vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  FloatingWalkthroughVideo: ({ className }: { className?: string }) => <div data-testid="card" className={className} />,
}));
vi.mock('@/app/hooks/use-walkthrough-video-data', () => ({
  WALKTHROUGH_DISMISS_STORAGE_KEY: 'walkthrough-dismissed',
  useWalkthroughVideoData: () => ({ video: { position: 'left' } }),
}));
vi.mock('@/lib/inline-walkthrough-signal', () => ({ useHasInlineWalkthrough: () => false }));

import { WalkthroughVideo } from './walkthrough-video';

const DOCK_VAR = '--of-composer-dock-live-height';
const SIDEBAR_VAR = '--of-sidebar-live-width';

let container: HTMLDivElement;
let root: Root;
let dock: HTMLDivElement;

beforeEach(() => {
  dock = document.createElement('div');
  dock.setAttribute('data-composer-dock', '');
  vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({ height: 94 } as DOMRect);
  document.body.appendChild(dock);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  dock.remove();
  vi.restoreAllMocks();
});

const cardScope = () => container.querySelector<HTMLElement>('[data-testid="card"]')?.parentElement;

describe('WalkthroughVideo clearance', () => {
  it("puts the dock's height and the sidebar's width on the card's wrapper, not on <html>", () => {
    act(() => root.render(<WalkthroughVideo />));

    expect(cardScope()?.style.getPropertyValue(DOCK_VAR)).toBe('94px');
    // No sidebar element in this document: the fixed fallback clearance.
    expect(cardScope()?.style.getPropertyValue(SIDEBAR_VAR)).not.toBe('');
    expect(document.documentElement.style.getPropertyValue(DOCK_VAR)).toBe('');
    expect(document.documentElement.style.getPropertyValue(SIDEBAR_VAR)).toBe('');
  });

  it('leaves <html> alone across a navigation', () => {
    const writes: string[] = [];
    const observer = new MutationObserver(records => {
      for (const record of records) writes.push(String(record.attributeName));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    act(() => root.render(<WalkthroughVideo />));

    state.pathname = '/tickets';
    act(() => root.render(<WalkthroughVideo />));

    observer.disconnect();
    expect(writes).toEqual([]);
    expect(cardScope()?.style.getPropertyValue(DOCK_VAR)).toBe('94px');
  });
});
