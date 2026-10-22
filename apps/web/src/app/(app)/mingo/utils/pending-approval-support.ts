/**
 * Whether the ai-agent serves `Dialog.pendingApproval`. A backend without the field
 * rejects the WHOLE query that selects it (GraphQL validation), so the chat history and
 * the Needs approval chats would fail to load on it. The classic shell asked for the
 * field only behind its flag; the Mingo-first shell asks always, and on the first such
 * refusal stops asking for the rest of the session: the history loads without the
 * approval glyph, and the approvals page finds no chats waiting.
 */
let pendingApprovalUnsupported = false;

/**
 * Whether the ai-agent takes the `DialogFilterInput.pendingApproval` filter, which came
 * after the field. A backend without it refuses the variable, and the approvals page then
 * lists every chat and keeps the waiting ones itself, as it did before the filter.
 */
let pendingApprovalFilterUnsupported = false;

/** The refusal of a query over a backend without `Dialog.pendingApproval`. */
export function isMissingPendingApprovalError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('pendingApproval');
}

/**
 * The refusal of the `pendingApproval` filter. It names the input type and the field's
 * refusal does not, so check it first: the field's check matches it too.
 */
export function isMissingPendingApprovalFilterError(error: unknown): boolean {
  return isMissingPendingApprovalError(error) && (error as Error).message.includes('DialogFilterInput');
}

export function pendingApprovalSupported(): boolean {
  return !pendingApprovalUnsupported;
}

export function notePendingApprovalUnsupported(): void {
  pendingApprovalUnsupported = true;
}

export function pendingApprovalFilterSupported(): boolean {
  return !pendingApprovalFilterUnsupported;
}

export function notePendingApprovalFilterUnsupported(): void {
  pendingApprovalFilterUnsupported = true;
}

/** Tests only: a fresh session. */
export function resetPendingApprovalSupport(): void {
  pendingApprovalUnsupported = false;
  pendingApprovalFilterUnsupported = false;
}
