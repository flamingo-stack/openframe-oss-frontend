// Pins what archiving the tour's conversation does: while the tour is on it
// skips the tour once the archive lands, so "Reset Onboarding" can bring it
// back; any other conversation, a failed archive or an ended tour leave the
// onboarding alone. And that the conversation keeps Mingo's greeting once the
// tour is over: it is a local message, and archiving the conversation (which
// skips the tour) then unarchiving it brought it back empty. It is dated when the
// conversation was created: dated when opened, a tour chat with nothing else in it
// read as a chat just started. And that "Skip
// Onboarding" skips the tour only once confirmed, closing the dialog when the
// skip lands. And that the block's × sets the conversation aside: the host closes
// it, and the block shows only while the conversation is on screen.

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type UserOnboardingProgress, useOnboardingStore } from '@/stores/onboarding-store';
import { clearGettingStartedView } from './getting-started-view';
import { type MingoTour, useMingoTour } from './use-mingo-tour';

const { skipUser, skipUserInBackground, trackDashboardActivity } = vi.hoisted(() => ({
  skipUser: vi.fn(),
  skipUserInBackground: vi.fn(),
  trackDashboardActivity: vi.fn(),
}));

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
    skipUser,
    skipUserInBackground,
    isMutating: false,
  }),
}));
vi.mock('@/lib/analytics', async importOriginal => ({
  ...(await importOriginal<object>()),
  trackDashboardActivity,
}));
// The block and the dialog as their buttons: what is pinned here is the hook's wiring.
vi.mock('./getting-started-block', () => ({
  GettingStartedBlock: ({ onSkip, onClose }: { onSkip: () => void; onClose: () => void }) => (
    <>
      <button type="button" onClick={onSkip}>
        Skip Onboarding
      </button>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </>
  ),
}));
vi.mock('@/app/components/shared/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirm skip
      </button>
    ) : null,
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
    setupSeen: false,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let tour: MingoTour;

function renderTour(
  archiveDialog: (id: string) => Promise<void>,
  activeDialogId = TOUR_DIALOG,
  {
    onScreen,
    onClose,
    dialogCreatedAt,
  }: { onScreen?: boolean; onClose?: () => void; dialogCreatedAt?: string | null } = {},
) {
  const state = {
    activeDialogId,
    sendMessage: vi.fn(),
    hasMoreMessages: false,
    messages: [],
    isLoading: false,
    selectDialog: vi.fn(),
    archiveDialog,
  } as unknown as UnifiedChatState;
  function Probe() {
    tour = useMingoTour({ state, createNamedDialog: vi.fn(), dialogError: null, dialogCreatedAt, onScreen, onClose });
    return <>{tour.aboveComposer}</>;
  }
  act(() => root.render(<Probe />));
  return state;
}

beforeEach(() => {
  // The closed block is remembered per user: every test starts with it open.
  clearGettingStartedView('u-1');
  skipUser.mockReset();
  skipUserInBackground.mockClear();
  trackDashboardActivity.mockClear();
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

describe('useMingoTour - the greeting', () => {
  const greetingIds = () => tour.state.messages.map(message => message.id);

  it('heads the tour conversation while the tour is on, with the Getting Started block', () => {
    useOnboardingStore.getState().setUser(progress());
    renderTour(vi.fn(async () => {}));

    expect(greetingIds()).toEqual([`tour-greeting-${TOUR_DIALOG}`]);
    expect(tour.aboveComposer).not.toBeNull();
  });

  it.each([
    ['skipped (its conversation archived, then unarchived)', { skipped: true }],
    ['finished', { completed: true }],
  ])('stays in the tour conversation once the tour is %s, without the block', (_, ended) => {
    useOnboardingStore.getState().setUser(progress(ended));
    renderTour(vi.fn(async () => {}));

    expect(greetingIds()).toEqual([`tour-greeting-${TOUR_DIALOG}`]);
    expect(tour.state.messages[0]).toMatchObject({ role: 'assistant' });
    expect(tour.aboveComposer).toBeNull();
  });

  it('is dated when the conversation was created, not when it was opened', () => {
    useOnboardingStore.getState().setUser(progress());
    renderTour(
      vi.fn(async () => {}),
      TOUR_DIALOG,
      { dialogCreatedAt: '2026-11-03T15:08:54.129Z' },
    );

    expect(tour.state.messages[0]).toMatchObject({ timestamp: '2026-11-03T15:08:54.129Z' });
  });

  it('is not added to any other conversation', () => {
    useOnboardingStore.getState().setUser(progress({ skipped: true }));
    renderTour(
      vi.fn(async () => {}),
      'd-other',
    );

    expect(greetingIds()).toEqual([]);
  });
});

describe('useMingoTour - Skip Onboarding', () => {
  const findButton = (text: string) =>
    [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === text) ?? null;
  const click = (text: string) =>
    act(() => findButton(text)?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  it('skips the tour only once confirmed, and closes the dialog when the skip lands', () => {
    skipUser.mockImplementation((onDone: () => void) => onDone());
    useOnboardingStore.getState().setUser(progress());
    renderTour(vi.fn(async () => {}));

    click('Skip Onboarding');
    expect(skipUser).not.toHaveBeenCalled();

    click('Confirm skip');
    expect(skipUser).toHaveBeenCalledTimes(1);
    expect(trackDashboardActivity).toHaveBeenCalledWith('skip_onboarding_mingo');
    expect(findButton('Confirm skip')).toBeNull();
  });

  it('keeps the dialog open while the skip has not landed', () => {
    useOnboardingStore.getState().setUser(progress());
    renderTour(vi.fn(async () => {}));

    click('Skip Onboarding');
    click('Confirm skip');

    expect(skipUser).toHaveBeenCalledTimes(1);
    expect(trackDashboardActivity).not.toHaveBeenCalled();
    expect(findButton('Confirm skip')).not.toBeNull();
  });
});

describe("useMingoTour - the block's ×", () => {
  const closeButton = () =>
    [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Close') ?? null;

  it('tells the host and takes the block off the page behind which the chat waits', () => {
    useOnboardingStore.getState().setUser(progress());
    const onClose = vi.fn();
    renderTour(
      vi.fn(async () => {}),
      TOUR_DIALOG,
      { onScreen: false, onClose },
    );
    expect(tour.aboveComposer).not.toBeNull();

    act(() => closeButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tour.aboveComposer).toBeNull();
    expect(skipUser).not.toHaveBeenCalled();
    expect(skipUserInBackground).not.toHaveBeenCalled();
  });

  it('keeps a closed block with its conversation wherever that is on screen', () => {
    useOnboardingStore.getState().setUser(progress());
    renderTour(
      vi.fn(async () => {}),
      TOUR_DIALOG,
      { onScreen: true },
    );
    act(() => closeButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(tour.aboveComposer).not.toBeNull();

    renderTour(
      vi.fn(async () => {}),
      TOUR_DIALOG,
      { onScreen: false },
    );
    expect(tour.aboveComposer).toBeNull();
  });
});
