/**
 * A page's sections are shown together: each draws its loading form until every one has
 * answered, then all of them switch in one commit.
 */

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVEAL_CAP_MS, RevealTogether, useRevealHeld, useRevealPart } from './reveal-together';

function Part({ id, answered }: { id: string; answered: boolean }) {
  useRevealPart(id, answered);
  const held = useRevealHeld();
  const shown = answered && !held;
  return <p data-part={id}>{shown ? 'content' : 'skeleton'}</p>;
}

function Page({ a, b }: { a: boolean; b: boolean }) {
  return (
    <RevealTogether>
      <Part id="a" answered={a} />
      <Part id="b" answered={b} />
    </RevealTogether>
  );
}

let container: HTMLDivElement;
let root: Root;

const state = (id: string) => container.querySelector(`[data-part="${id}"]`)?.textContent;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('RevealTogether', () => {
  it('keeps an answered section in its loading form until the other answers, then shows both', () => {
    act(() => root.render(<Page a b={false} />));
    expect(state('a')).toBe('skeleton');
    expect(state('b')).toBe('skeleton');

    act(() => root.render(<Page a b />));
    expect(state('a')).toBe('content');
    expect(state('b')).toBe('content');
  });

  it('holds nothing back when every section has answered on mount (cached), also in a dev remount', () => {
    act(() =>
      root.render(
        <StrictMode>
          <Page a b />
        </StrictMode>,
      ),
    );
    expect(state('a')).toBe('content');
    expect(state('b')).toBe('content');
  });

  it('is not released by the first section to report on mount', () => {
    act(() =>
      root.render(
        <StrictMode>
          <Page a b={false} />
        </StrictMode>,
      ),
    );
    expect(state('a')).toBe('skeleton');
  });

  it('stays shown once shown', () => {
    act(() => root.render(<Page a b />));
    act(() => root.render(<Page a={false} b />));
    expect(state('b')).toBe('content');
  });

  it('shows what has answered once a late section has held it for the cap', () => {
    vi.useFakeTimers();
    act(() => root.render(<Page a b={false} />));
    expect(state('a')).toBe('skeleton');
    act(() => vi.advanceTimersByTime(REVEAL_CAP_MS));
    expect(state('a')).toBe('content');
    expect(state('b')).toBe('skeleton');
  });

  it('holds nothing outside such a page', () => {
    act(() => root.render(<Part id="a" answered />));
    expect(state('a')).toBe('content');
  });
});
