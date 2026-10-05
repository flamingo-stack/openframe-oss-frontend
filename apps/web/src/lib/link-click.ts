/**
 * Whether a click on a link navigates THIS window, rather than handing the href
 * to a new tab (cmd/ctrl-click, shift/alt-click, middle button) and leaving the
 * current page — and anything drawn over it — exactly where it was.
 *
 * The distinction matters to any surface that dismisses itself when a link
 * inside it is followed: a drawer that closed on a cmd-click would take away the
 * surface the user deliberately kept open.
 *
 * Structurally typed so both a DOM `MouseEvent` and a React synthetic one fit.
 */
export function navigatesCurrentWindow(
  event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
