/**
 * After a sort or a filter change a list returns to its first row. A grid table that is its page's scroll area
 * scrolls inside itself, so the page's own scroll is the wrong one to reset there.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollListToTop } from './scroll-list-to-top';

/** An element that scrolls (or not), with a `scrollTo` to watch: jsdom lays nothing out. */
function box(tag: string, { overflowY = 'visible', scrolls = false }: { overflowY?: string; scrolls?: boolean } = {}) {
  const element = document.createElement(tag);
  element.style.overflowY = overflowY;
  Object.defineProperty(element, 'clientHeight', { value: 400 });
  Object.defineProperty(element, 'scrollHeight', { value: scrolls ? 1200 : 400 });
  element.scrollTo = vi.fn() as unknown as typeof element.scrollTo;
  return element;
}

/** `<main>` > the list > (the table's own viewport) > the grid body, in the document. */
function page({ viewport, grid = true }: { viewport?: HTMLElement; grid?: boolean } = {}) {
  const main = box('main', { overflowY: 'auto', scrolls: true });
  const list = box('div');
  const body = document.createElement('div');
  if (grid) body.setAttribute('data-grid-body', '');
  (viewport ?? list).append(body);
  if (viewport) list.append(viewport);
  main.append(list);
  document.body.append(main);
  return { main, list };
}

const TOP = { top: 0, behavior: 'instant' };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('scrollListToTop', () => {
  it('scrolls the grid table’s own area when the table is the page’s scroll area', () => {
    const viewport = box('div', { overflowY: 'auto', scrolls: true });
    const { main, list } = page({ viewport });
    scrollListToTop(list);
    expect(viewport.scrollTo).toHaveBeenCalledWith(TOP);
    expect(main.scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls the page for a grid table at its natural height', () => {
    const { main, list } = page();
    scrollListToTop(list);
    expect(main.scrollTo).toHaveBeenCalledWith(TOP);
  });

  it('passes a table area with nothing to scroll and scrolls the page', () => {
    const viewport = box('div', { overflowY: 'auto', scrolls: false });
    const { main, list } = page({ viewport });
    scrollListToTop(list);
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(main.scrollTo).toHaveBeenCalledWith(TOP);
  });

  it('scrolls the page for card rows, and with no list at hand', () => {
    const { main, list } = page({ grid: false });
    scrollListToTop(list);
    scrollListToTop(null);
    expect(main.scrollTo).toHaveBeenCalledTimes(2);
  });
});
