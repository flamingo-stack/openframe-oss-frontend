/**
 * Returns a list to its first row, after its sort or its filters change.
 *
 * A grid table that is its page's scroll area (`maxHeight="fill"`) scrolls inside itself, so scrolling the page does
 * nothing there: the list's own scroll area is the nearest scrolling ancestor of the table's body. Card rows, and a
 * grid table at its natural height, scroll with the page (`<main>`).
 *
 * `list`: an element around the table (the page's content column).
 */
export function scrollListToTop(list: Element | null): void {
  const body = list?.querySelector('[data-grid-body]');
  const area = (body && nearestScrollArea(body)) ?? document.querySelector('main');
  area?.scrollTo({ top: 0, behavior: 'instant' });
}

/** The closest ancestor that scrolls vertically and has something to scroll. */
function nearestScrollArea(element: Element): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}
