// Pins what archiving the tour's conversation does: while the tour is on it
// skips the tour once the archive lands, so "Reset Onboarding" can bring it
// back; any other conversation, a failed archive or an ended tour leave the
// onboarding alone.

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type UserOnboardingProgress, useOnboardingStore } from '@/stores/onboarding-store';
import { type MingoTour, useMingoTour } from './use-mingo-tour';

const { skipUserInBackground } = vi.hoisted(() => ({ skipUserInBackground: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-relay', () => ({ useRelayEnvironment: () => ({}) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { id: string; firstName: string } }) => unknown) =>
    selector({ user: { id: 'u-1', firstName: 'Ann' } }),
}));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlag: () => false }));
vi.mock('@/app/(app)/setup/lib/tour-state', () => ({ useTourState: () => null }));
vi.mock('@/app/(app)/setup/hooks/use-first-device-enrollment', () => ({ fetchFirstDevice: vi.fn() }));
vi.mock('../hooks/use-mingo-dialog-selection', () => ({ MINGO_DIALOG_NOT_FOUND: 'MINGO_DIALOG_NOT_FOUND' }));
vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({
    completeUserStepInBackground: vi.fn(),
    completeUserInBackground: vi.fn(),
    setTourDialogInBackground: vi.fn(),
    skipUserInBackground,
  }),
}));

const TOUR_DIALOG = 'd-tour';

function progress(overrides: Partial<UserOnboardingProgress> = {}): UserOnboardingProgress {
  return {
    completedSteps: [],
    completed: false,
    completedAt: null,
    skipped: false,
    skippedAt: null,
    tourDialogId: TOUR_DIALOG,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let tour: MingoTour;

function renderTour(archiveDialog: (id: string) => Promise<void>) {
  const state = {
    activeDialogId: TOUR_DIALOG,
    sendMessage: vi.fn(),
    hasMoreMessages: false,
    messages: [],
    isLoading: false,
    selectDialog: vi.fn(),
    archiveDialog,
  } as unknown as UnifiedChatState;
  function Probe() {
    tour = useMingoTour({ state, createNamedDialog: vi.fn(), dialogError: null });
    return null;
  }
  act(() => root.render(<Probe />));
  return state;
}

beforeEach(() => {
  skipUserInBackground.mockClear();
  useOnboardingStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useMingoTour - archiving', () => {
  it("skips the tour once its conversation's archive lands", async () => {
    useOnboardingStore.getState().setUser(progress());
    const archive = vi.fn(async () => {});
    renderTour(archive);

    await act(() => tour.state.archiveDialog(TOUR_DIALOG));

    expect(archive).toHaveBeenCalledWith(TOUR_DIALOG);
    expect(skipUserInBackground).toHaveBeenCalledTimes(1);
  });

  it('leaves the tour alone when another conversation is archived', async () => {
    useOnboardingStore.getState().setUser(progress());
    const archive = vi.fn(async () => {});
    renderTour(archive);

    await act(() => tour.state.archiveDialog('d-other'));

    expect(archive).toHaveBeenCalledWith('d-other');
    expect(skipUserInBackground).not.toHaveBeenCalled();
  });

  it('leaves the tour alone when the archive fails', async () => {
    useOnboardingStore.getState().setUser(progress());
    renderTour(vi.fn(async () => Promise.reject(new Error('nope'))));

    await act(async () => {
      await expect(tour.state.archiveDialog(TOUR_DIALOG)).rejects.toThrow('nope');
    });

    expect(skipUserInBackground).not.toHaveBeenCalled();
  });

  it('passes the archive through untouched once the tour is over', () => {
    useOnboardingStore.getState().setUser(progress({ completed: true }));
    const state = renderTour(vi.fn(async () => {}));

    expect(tour.state.archiveDialog).toBe(state.archiveDialog);
  });
});
