// PoC: the approval card has no slot for the RMM classifier's review yet, so the review rides in
// the tool explanation the card already lists. Admin approvals only — a client never sees it.

const APPROVAL_REQUEST = 'APPROVAL_REQUEST';
const ADMIN_APPROVAL = 'ADMIN';
const SEPARATOR = ' · ';

type UnknownRecord = Record<string, unknown>;

/** Adds the classifier's review to every tool explanation of an admin approval chunk. */
export function annotateApprovalChunk<T>(chunk: T): T {
  if (!isAdminApprovalRequest(chunk)) return chunk;
  const toolCalls = chunk.toolCalls.map(annotateToolCall);
  return { ...chunk, toolCalls };
}

/** Same as `annotateApprovalChunk` for a persisted message, whose data is one chunk or a list. */
export function annotateMessageData<T>(messageData: T): T {
  if (Array.isArray(messageData)) return messageData.map(annotateApprovalChunk) as T;
  return annotateApprovalChunk(messageData);
}

/** "AI review: Security Weaken — turns off real-time protection [MANAGE_ANTIVIRUS]" */
export function formatCommandReview(review: UnknownRecord): string {
  const rules = strings(review.matchedRules, rule => (isRecord(rule) ? rule.label : undefined));
  const codes = strings(review.operationCodes, code => code);
  const verdict = rules.length > 0 ? rules.join(', ') : 'no block rule';
  const reason = typeof review.reason === 'string' && review.reason.trim() ? ` — ${review.reason.trim()}` : '';
  const operations = codes.length > 0 ? ` [${codes.join(', ')}]` : '';
  return `AI review: ${verdict}${reason}${operations}`;
}

function annotateToolCall(call: unknown): unknown {
  if (!isRecord(call) || !isRecord(call.commandReview)) return call;
  const summary = formatCommandReview(call.commandReview);
  const explanation = typeof call.toolExplanation === 'string' ? call.toolExplanation.trim() : '';
  const toolExplanation = explanation ? `${explanation}${SEPARATOR}${summary}` : summary;
  return { ...call, toolExplanation };
}

function isAdminApprovalRequest<T>(chunk: T): chunk is T & { toolCalls: unknown[] } {
  return (
    isRecord(chunk) &&
    chunk.type === APPROVAL_REQUEST &&
    chunk.approvalType === ADMIN_APPROVAL &&
    Array.isArray(chunk.toolCalls)
  );
}

function strings(raw: unknown, pick: (item: unknown) => unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(pick).filter((value): value is string => typeof value === 'string' && value.trim() !== '');
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
