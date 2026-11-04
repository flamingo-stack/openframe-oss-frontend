/**
 * Plan-change failures as the billing page reports them. A downgrade that Cloud
 * Armor refused came back as a bare 502 and was toasted as "Relay fetch failed:
 * 502 Bad Gateway" (CU-17tkuw5z1e3); it should say the change was not saved.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type UpdateSubscriptionInput, useUpdateSubscription } from './use-update-subscription';

const spies = vi.hoisted(() => ({
  commit: vi.fn(),
  toast: vi.fn(),
}));

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useMutation: () => [spies.commit, false],
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

/** What relay-runtime throws for a mutation that answered with errors and no data. */
function relayError(message: string): Error {
  return Object.assign(new Error(`No data returned for operation, got error(s):\n${message}`), {
    source: { errors: [{ message }] },
  });
}

let container: HTMLDivElement;
let root: Root;

function Harness() {
  const { mutate } = useUpdateSubscription();
  return <button type="button" onClick={() => mutate({} as UpdateSubscriptionInput)} />;
}

function failUpdateWith(error: Error) {
  act(() => container.querySelector('button')?.click());
  const { onError } = spies.commit.mock.calls[0][0];
  act(() => onError(error));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('useUpdateSubscription — failures', () => {
  it('gateway refusal (no GraphQL answer): says the plan change was not saved', () => {
    failUpdateWith(new Error('Relay fetch failed: 502 Bad Gateway'));

    expect(spies.toast).toHaveBeenCalledExactlyOnceWith({
      title: 'Update Failed',
      description: "Your plan change wasn't saved. Please try again; if it keeps failing, contact support.",
      variant: 'destructive',
    });
  });

  it('backend error with a code but no message: says the plan change was not saved', () => {
    const error = Object.assign(new Error('No data returned for operation, got error(s):\n'), {
      source: { errors: [{ extensions: { code: 'INTERNAL' } }] },
    });
    failUpdateWith(error);

    expect(spies.toast).toHaveBeenCalledExactlyOnceWith({
      title: 'Update Failed',
      description: "Your plan change wasn't saved. Please try again; if it keeps failing, contact support.",
      variant: 'destructive',
    });
  });

  it('backend refusal: shows the backend message', () => {
    failUpdateWith(relayError('Subscription not found'));

    expect(spies.toast).toHaveBeenCalledExactlyOnceWith({
      title: 'Update Failed',
      description: 'Subscription not found',
      variant: 'destructive',
    });
  });
});
