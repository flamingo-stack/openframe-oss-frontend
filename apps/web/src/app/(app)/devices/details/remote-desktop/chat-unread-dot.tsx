/**
 * The new-message marker on the Open Chat toggle: a yellow dot, no counter, on
 * the button's top-right corner. The parent is `relative`; the dot is decorative
 * (the button carries the "new message" wording for screen readers).
 */
export function ChatUnreadDot() {
  return (
    <span
      aria-hidden
      data-testid="chat-unread-dot"
      className="pointer-events-none absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-ods-card bg-ods-accent"
    />
  );
}
