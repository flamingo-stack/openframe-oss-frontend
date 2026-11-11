/**
 * The Manhattan v2 chat column header's cells after the chat's ⋯ (plan matrix H, table T).
 */

import { Collapse02Icon, Expand01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { describe, expect, it, vi } from 'vitest';
import { manhattanHeaderActions } from './manhattan-chat-header-actions';

function labels(options: Partial<Parameters<typeof manhattanHeaderActions>[0]>) {
  return manhattanHeaderActions({
    route: 'page',
    columnMode: 'split',
    openDialogId: 'd-1',
    lastPage: '/devices',
    showBesidePage: vi.fn(),
    fullScreen: vi.fn(),
    restoreSplit: vi.fn(),
    closeChat: vi.fn(),
    ...options,
  })?.map(action => action.label);
}

describe('manhattanHeaderActions', () => {
  it('in split: full screen, close', () => {
    expect(labels({})).toEqual(['Full screen', 'Close chat']);
  });

  it('over a page, a full-height one too: side by side, close; in one column: close only', () => {
    expect(labels({ columnMode: 'chat' })).toEqual(['Show side by side', 'Close chat']);
    expect(labels({ columnMode: 'chat', route: 'full-width' })).toEqual(['Show side by side', 'Close chat']);
    expect(labels({ columnMode: 'chat', compact: true })).toEqual(['Close chat']);
  });

  it("on the chat's page: side by side only with a page to go back to", () => {
    expect(labels({ route: 'chat', columnMode: 'page' })).toEqual(['Show side by side', 'Close chat']);
    expect(labels({ route: 'chat', columnMode: 'page', lastPage: null })).toEqual(['Close chat']);
    expect(labels({ route: 'chat', columnMode: 'page', openDialogId: null })).toEqual(['Close chat']);
  });

  it('draws side by side with collapse-02, full screen with expand-01 (ODS)', () => {
    const glyph = (options: Partial<Parameters<typeof manhattanHeaderActions>[0]>) =>
      manhattanHeaderActions({
        route: 'page',
        columnMode: 'split',
        openDialogId: 'd-1',
        lastPage: '/devices',
        showBesidePage: vi.fn(),
        fullScreen: vi.fn(),
        restoreSplit: vi.fn(),
        closeChat: vi.fn(),
        ...options,
      })?.[0]?.icon.type;
    expect(glyph({})).toBe(Expand01Icon);
    expect(glyph({ columnMode: 'chat' })).toBe(Collapse02Icon);
    expect(glyph({ route: 'chat', columnMode: 'page' })).toBe(Collapse02Icon);
  });

  it('none while the column is hidden', () => {
    expect(labels({ columnMode: 'page' })).toBeUndefined();
  });

  it('runs the matching action', () => {
    const fullScreen = vi.fn();
    const closeChat = vi.fn();
    const actions = manhattanHeaderActions({
      route: 'page',
      columnMode: 'split',
      openDialogId: 'd-1',
      lastPage: null,
      showBesidePage: vi.fn(),
      fullScreen,
      restoreSplit: vi.fn(),
      closeChat,
    });
    actions?.[0].onClick();
    actions?.[1].onClick();
    expect(fullScreen).toHaveBeenCalledOnce();
    expect(closeChat).toHaveBeenCalledOnce();
  });

  it('compact: nothing side by side, only close', () => {
    expect(labels({ columnMode: 'chat', compact: true })).toEqual(['Close chat']);
    expect(labels({ route: 'chat', columnMode: 'page', compact: true })).toEqual(['Close chat']);
  });
});
