/**
 * EmptyState fills the scroll container below the page. With a docked side
 * panel `<main>` wraps the page in a `display: contents` scope, which reports
 * an empty rect: measured as the page, it added the whole container's height to
 * the fill and pushed the empty state below the fold.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './empty-state';

let root: Root | null = null;

/** `<main>` > optional `display: contents` scope > page wrapper; the empty state renders in the page. */
function mountInPage(withScope: boolean): HTMLElement {
  const main = document.createElement('main');
  const page = document.createElement('div');
  if (withScope) {
    const scope = document.createElement('div');
    scope.style.display = 'contents';
    scope.append(page);
    main.append(scope);
  } else {
    main.append(page);
  }
  document.body.append(main);

  // jsdom lays nothing out: the scroll container ends at 1000px and the page at
  // 600px, so 400px are free below it. Anything else, the scope included, is empty.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const bottom = this === main ? 1000 : this === page ? 600 : 0;
    return { bottom, top: 0, left: 0, right: 0, width: 0, height: bottom, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );

  root = createRoot(page);
  act(() => {
    root?.render(<EmptyState title="No Customers yet" />);
  });
  return page.firstElementChild as HTMLElement;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('EmptyState fill height', () => {
  it('fills the space below the page', () => {
    expect(mountInPage(false).style.minHeight).toBe('max(60vh, 400px)');
  });

  it('measures the page, not a display: contents scope around it', () => {
    expect(mountInPage(true).style.minHeight).toBe('max(60vh, 400px)');
  });
});
