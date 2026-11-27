/**
 * The most characters a Mingo message may have: the ai-agent's `@Size(min = 1, max = 10000)` on
 * `SendMessageInput.content` (openframe-saas-tenant). The composer counts down to it and refuses to send over it
 * (`composerMaxLength`); both count UTF-16 code units, the backend's `String.length` and the editor's `length`.
 */
export const MINGO_MESSAGE_MAX_LENGTH = 10_000;

export const MESSAGE_TOO_LONG_TEXT = 'Message is over 10,000 characters';
export const MESSAGE_REFUSED_TEXT = "Mingo couldn't accept this message";

/** The ai-agent's refusal of a message over the limit, in any casing: `sendMessage.input.content: … 10000 …`. */
const CONTENT_LENGTH_REFUSAL = /\bsendMessage\.input\.content\b.*\b10000\b/i;

/**
 * Another Bean Validation refusal as graphql-java words it: a property path, then the constraint's message
 * (`sendMessage.input.currentPage.title: size must be …`). A raw path the user cannot act on.
 */
const VALIDATION_REFUSAL = /^[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)+\s*:/i;

/**
 * What a failed Mingo send leaves in the thread (`useChatEngine`'s `sendFailureText`): plain words for a refusal of
 * the message itself, never the server's raw path. A refusal is not retried: the same message fails the same way, so
 * there is no "try again". Every other failure (a refusal the backend words for the user, a dropped connection) keeps
 * its own text, as the engine's default does.
 */
export function mingoSendFailureText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (CONTENT_LENGTH_REFUSAL.test(text)) return MESSAGE_TOO_LONG_TEXT;
  if (VALIDATION_REFUSAL.test(text.trim())) return MESSAGE_REFUSED_TEXT;
  return text;
}
