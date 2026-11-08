/**
 * The Manhattan v2 chat column header's cells after the chat's ⋯ (plan matrix H, table T).
 */

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

  it('over a page: side by side, close; over a full-height page: close only', () => {
    expect(labels({ columnMode: 'chat' })).toEqual(['Show side by side', 'Close chat']);
    expect(labels({ columnMode: 'chat', route: 'full-width' })).toEqual(['Close chat']);
  });

  it("on the chat's page: side by side only with a page to go back to", () => {
    expect(labels({ route: 'chat', columnMode: 'page' })).toEqual(['Show side by side', 'Close chat']);
    expect(labels({ route: 'chat', columnMode: 'page', lastPage: null })).toEqual(['Close chat']);
    expect(labels({ route: 'chat', columnMode: 'page', openDialogId: null })).toEqual(['Close chat']);
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
});
