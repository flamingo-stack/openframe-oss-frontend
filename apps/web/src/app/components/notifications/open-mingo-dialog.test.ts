/**
 * The dialog-open seam: one decision, drawer or chat page, made at click time from
 * the shell variant and whether a drawer is mounted. Never a guess while the flag is
 * unanswered — the chat route resolves itself once it is.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { toGlobalId } from '@/lib/relay-id';
import { registerShellNavigator } from '@/lib/shell-navigator';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { normalizeMingoDialogId, openMingoDialog, resolveMingoDialogSurface } from './open-mingo-dialog';

describe('resolveMingoDialogSurface', () => {
  it('opens the drawer only in the classic shell with a drawer mounted', () => {
    expect(resolveMingoDialogSurface('classic', true)).toBe('drawer');
  });

  it('routes everywhere else: the Mingo-first shell, an unanswered flag, a classic shell with no drawer', () => {
    expect(resolveMingoDialogSurface('mingo', true)).toBe('route');
    expect(resolveMingoDialogSurface('mingo', false)).toBe('route');
    expect(resolveMingoDialogSurface('loading', true)).toBe('route');
    expect(resolveMingoDialogSurface('classic', false)).toBe('route');
  });
});

describe('openMingoDialog', () => {
  const push = vi.fn<(href: string) => void>();
  let unregister: () => void;

  beforeEach(() => {
    push.mockReset();
    unregister = registerShellNavigator(push);
    useMingoLauncherStore.setState({ isOpen: false, canOpen: true });
    useMingoMessagesStore.getState().setActiveDialogId(null);
  });

  afterEach(() => {
    unregister();
    useFeatureFlagsStore.getState().reset();
  });

  it('opens the classic drawer on the dialog, without navigating', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: false }]);

    expect(openMingoDialog('d-1')).toBe('drawer');
    expect(useMingoMessagesStore.getState().activeDialogId).toBe('d-1');
    expect(useMingoLauncherStore.getState().isOpen).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('navigates to the chat page in the Mingo-first shell, drawer or not', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: true }]);

    expect(openMingoDialog('d-1')).toBe('route');
    expect(push).toHaveBeenCalledWith('/mingo/chat?id=d-1');
    expect(useMingoLauncherStore.getState().isOpen).toBe(false);
  });

  it('routes while the flag is unanswered, rather than guessing a drawer', () => {
    expect(openMingoDialog('d-1')).toBe('route');
    expect(push).toHaveBeenCalledWith('/mingo/chat?id=d-1');
    expect(useMingoLauncherStore.getState().isOpen).toBe(false);
  });

  it('routes in the classic shell when no drawer is mounted (lock screen)', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: false }]);
    useMingoLauncherStore.setState({ canOpen: false });

    expect(openMingoDialog('d-1')).toBe('route');
    expect(push).toHaveBeenCalledWith('/mingo/chat?id=d-1');
  });

  it('navigates through a caller-supplied router when given one', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: true }]);
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
