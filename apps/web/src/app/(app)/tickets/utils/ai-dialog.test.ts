import { describe, expect, it } from 'vitest';
import { DIALOG_MODE } from '../constants';
import { hasActiveAiDialog } from './ai-dialog';
import { TICKET_STATUS_KIND } from './ticket-statistics';

const aiHandling = { dialogId: 'd-1', currentMode: DIALOG_MODE.AI, statusKind: TICKET_STATUS_KIND.AI_ASSISTANCE };

describe('hasActiveAiDialog', () => {
  it('is true for an AI Handling ticket whose dialog is still in AI mode', () => {
    expect(hasActiveAiDialog(aiHandling)).toBe(true);
  });

  it('is false once the dialog was switched to DIRECT (taken over)', () => {
    expect(hasActiveAiDialog({ ...aiHandling, currentMode: DIALOG_MODE.DIRECT })).toBe(false);
  });

  it('is false for a ticket reopened into Tech Required with the dialog still in AI mode (86ak573q9)', () => {
    expect(hasActiveAiDialog({ ...aiHandling, statusKind: TICKET_STATUS_KIND.TECH_REQUIRED })).toBe(false);
  });

  it('is false outside AI Handling whatever the dialog mode says', () => {
    for (const statusKind of [
      TICKET_STATUS_KIND.TECH_REQUIRED,
      TICKET_STATUS_KIND.CUSTOM,
      TICKET_STATUS_KIND.RESOLVED,
      TICKET_STATUS_KIND.ARCHIVED,
    ]) {
      expect(hasActiveAiDialog({ ...aiHandling, statusKind })).toBe(false);
    }
  });

  it('is false without a dialog, without a status kind, or without a ticket', () => {
    expect(hasActiveAiDialog({ ...aiHandling, dialogId: undefined })).toBe(false);
    expect(hasActiveAiDialog({ ...aiHandling, statusKind: undefined })).toBe(false);
    expect(hasActiveAiDialog(null)).toBe(false);
    expect(hasActiveAiDialog(undefined)).toBe(false);
  });
});
