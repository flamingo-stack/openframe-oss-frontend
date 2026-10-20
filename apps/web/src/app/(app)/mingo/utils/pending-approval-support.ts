/**
 * Whether the ai-agent serves `Dialog.pendingApproval`. A backend without the field
 * rejects the WHOLE query that selects it (GraphQL validation), so the chat history and
 * the Needs approval chats would fail to load on it. The classic shell asked for the
 * field only behind its flag; the Mingo-first shell asks always, and on the first such
 * refusal stops asking for the rest of the session: the history loads without the
 * approval glyph, and the approvals page finds no chats waiting.
 */
let pendingApprovalUnsupported = false;

/** The refusal of a query over a backend without `Dialog.pendingApproval`. */
export function isMissingPendingApprovalError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('pendingApproval');
}

export function pendingApprovalSupported(): boolean {
  return !pendingApprovalUnsupported;
}

export function notePendingApprovalUnsupported(): void {
  pendingApprovalUnsupported = true;
}

/** Tests only: a fresh session. */
export function resetPendingApprovalSupport(): void {
  pendingApprovalUnsupported = false;
}
