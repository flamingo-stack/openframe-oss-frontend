/** The dialog-open seam: a conversation opens over the page when the dock can, else on its chat page. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { toGlobalId } from '@/lib/relay-id';
import { registerShellNavigator } from '@/lib/shell-navigator';
import { canOpenMingoDialogOverPage, normalizeMingoDialogId, openMingoDialog } from './open-mingo-dialog';

describe('openMingoDialog', () => {
  const push = vi.fn<(href: string) => void>();
  let unregister: () => void;

  beforeEach(() => {
    push.mockReset();
    unregister = registerShellNavigator(push);
    useMingoLauncherStore.setState({ dockMounted: false, dockRequest: null });
  });

  afterEach(() => unregister());

  it('asks the dock to open it over the page while the dock is mounted', () => {
    useMingoLauncherStore.setState({ dockMounted: true });
    expect(canOpenMingoDialogOverPage()).toBe(true);

    openMingoDialog('d-1');
    expect(useMingoLauncherStore.getState().dockRequest).toEqual({ kind: 'open', dialogId: 'd-1' });
    expect(push).not.toHaveBeenCalled();
  });

  it('navigates to the chat page without a dock', () => {
    expect(canOpenMingoDialogOverPage()).toBe(false);
    openMingoDialog('d-1');
    expect(push).toHaveBeenCalledWith('/mingo/chat?id=d-1');
  });

  it('navigates through a caller-supplied router when given one', () => {
    const navigate = vi.fn<(href: string) => void>();

    openMingoDialog('d-1', { navigate });
    expect(navigate).toHaveBeenCalledWith('/mingo/chat?id=d-1');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('normalizeMingoDialogId', () => {
  const RAW = '6ac4e3a3fb523d620947f238';

  it('unwraps a Dialog global id and leaves a raw one alone', () => {
    expect(normalizeMingoDialogId(toGlobalId('Dialog', RAW))).toBe(RAW);
    expect(normalizeMingoDialogId(RAW)).toBe(RAW);
  });

  it('leaves a global id of another type as is', () => {
    const ticket = toGlobalId('Ticket', RAW);
    expect(normalizeMingoDialogId(ticket)).toBe(ticket);
  });
});
