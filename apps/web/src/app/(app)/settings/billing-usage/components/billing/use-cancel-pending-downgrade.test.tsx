/**
 * Undo Downgrade refreshes the page whatever the answer, and a refusal reads as the user's situation, not the
 * backend's message with the tenant id in it (CU-17tkuw60vqu, QA notes).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCancelPendingDowngrade } from './use-cancel-pending-downgrade';

interface CommitConfig {
  onCompleted: (response: unknown, errors: readonly { message: string }[] | null) => void;
  onError: (error: Error) => void;
}

const spies = vi.hoisted(() => ({ toast: vi.fn(), commit: vi.fn((_config: CommitConfig) => {}) }));

// No Relay transform under vitest: the tag is inert and the mutation is the spy.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useMutation: () => [spies.commit, false],
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: spies.toast }) }));

function Harness({ onSettled }: { onSettled: () => void }) {
  const undo = useCancelPendingDowngrade();
  return (
    <button type="button" onClick={() => undo.mutate({ onSettled })}>
      Undo Downgrade
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function undoAndAnswer(answer: (config: CommitConfig) => void) {
  const onSettled = vi.fn();
  act(() => root.render(<Harness onSettled={onSettled} />));
  act(() => container.querySelector('button')?.click());
  const config = spies.commit.mock.lastCall?.[0];
  if (!config) throw new Error('nothing committed');
  answer(config);
  return onSettled;
}

const REFUSAL = 'No pending downgrade to cancel: 1877e27c-0000-0000-0000-000000000000';

describe('useCancelPendingDowngrade', () => {
  it('refreshes the page after an undo', () => {
    const onSettled = undoAndAnswer(c => c.onCompleted({ cancelPendingDowngrade: { errors: [] } }, null));

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Downgrade Undone' }));
  });

  it('refreshes a page older than the subscription, and never shows the backend text', () => {
    const onSettled = undoAndAnswer(c => c.onCompleted({ cancelPendingDowngrade: null }, [{ message: REFUSAL }]));

    expect(onSettled).toHaveBeenCalledTimes(1);
    const shown = spies.toast.mock.lastCall?.[0] as { title: string; description: string };
    expect(shown.title).toBe('Undo Failed');
    expect(shown.description).not.toContain('1877e27c');
    expect(shown.description).toContain('current plan');
  });

  it('does the same for a domain error in the payload and for a network failure', () => {
    const fromPayload = undoAndAnswer(c =>
      c.onCompleted({ cancelPendingDowngrade: { errors: [{ message: REFUSAL }] } }, null),
    );
    const fromNetwork = undoAndAnswer(c => c.onError(new Error(REFUSAL)));

    expect(fromPayload).toHaveBeenCalledTimes(1);
    expect(fromNetwork).toHaveBeenCalledTimes(1);
    for (const [shown] of spies.toast.mock.calls as [{ title: string; description: string }][]) {
      expect(shown.title).toBe('Undo Failed');
      expect(shown.description).not.toContain('1877e27c');
    }
  });
});
