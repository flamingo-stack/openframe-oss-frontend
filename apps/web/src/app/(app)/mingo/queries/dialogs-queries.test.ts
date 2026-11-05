import { describe, expect, it } from 'vitest';
import { GET_MINGO_DIALOGS_QUERY, GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY } from './dialogs-queries';

/**
 * A backend without `Dialog.pendingApproval` rejects any query that names it, so
 * only the Mingo v2 list asks: the base query feeds v1, the archive and incidents.
 */
describe('the chat list queries', () => {
  it('leave pendingApproval out of the base query', () => {
    expect(GET_MINGO_DIALOGS_QUERY).not.toContain('pendingApproval');
    expect(GET_MINGO_DIALOGS_QUERY).toContain('streamState');
  });

  it('add it to the v2 list query and nothing else', () => {
    const withoutField = GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY.replace(
      /\s*pendingApproval \{\s*id\s*approvalType\s*\}/,
      '',
    );
    expect(GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY).toContain('pendingApproval');
    expect(withoutField.replace(/\s+/g, ' ')).toBe(GET_MINGO_DIALOGS_QUERY.replace(/\s+/g, ' '));
  });
});
