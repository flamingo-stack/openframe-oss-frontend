/**
 * The variant as components see it: subscribed to the flag store AND the opt-out, so
 * either change re-renders in place; and the redirect a shell-specific route issues,
 * never while the variant is unanswered.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setClassicLayout } from '@/lib/shell-variant';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useMingoV2ChatGate, useShellRedirect, useShellVariant } from './use-shell-variant';

const replace = vi.hoisted(() => vi.fn<(href: string) => void>());
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  replace.mockReset();
  useFeatureFlagsStore.getState().reset();
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

function Probe() {
  return (
    <span>
      {useShellVariant()}/{useMingoV2ChatGate()}
    </span>
  );
}

describe('useShellVariant', () => {
  it('re-renders on the flag answer and on the opt-out, without a reload', () => {
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe('loading/loading');

    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: true }]));
    expect(container.textContent).toBe('mingo/on');

    act(() => setClassicLayout(true));
    expect(container.textContent).toBe('classic/off');

    act(() => setClassicLayout(false));
    expect(container.textContent).toBe('mingo/on');
  });
});

function Redirect({ target, carryLocation }: { target: string | null; carryLocation?: boolean }) {
  useShellRedirect(target, { carryLocation });
  return null;
}

describe('useShellRedirect', () => {
  it('stays put on null', () => {
    act(() => root.render(<Redirect target={null} />));
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces the URL with the target', () => {
    act(() => root.render(<Redirect target="/notifications" />));
    expect(replace).toHaveBeenCalledWith('/notifications');
  });

  it('carries the live query and fragment when asked', () => {
    window.history.replaceState(null, '', '/dashboard?mingoDialog=d-1&utm_source=ad#top');
    act(() => root.render(<Redirect target="/mingo" carryLocation />));
    expect(replace).toHaveBeenCalledWith('/mingo?mingoDialog=d-1&utm_source=ad#top');
  });
});
