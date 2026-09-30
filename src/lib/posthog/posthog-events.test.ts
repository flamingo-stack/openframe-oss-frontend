import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePosthogException } from './posthog-events';

const win = window as unknown as { posthog?: unknown };

describe('capturePosthogException', () => {
  afterEach(() => {
    delete win.posthog;
  });

  it('sends the error and its properties to the GTM-loaded instance', () => {
    const captureException = vi.fn();
    win.posthog = { captureException };
    const error = new Error('boom');

    capturePosthogException(error, { error_boundary: 'Error Boundary' });

    expect(captureException).toHaveBeenCalledWith(error, { error_boundary: 'Error Boundary' });
  });

  it('does nothing when PostHog is not loaded', () => {
    expect(() => capturePosthogException(new Error('boom'))).not.toThrow();
  });

  it('never throws when PostHog itself throws', () => {
    win.posthog = {
      captureException: () => {
        throw new Error('posthog failed');
      },
    };

    expect(() => capturePosthogException(new Error('boom'))).not.toThrow();
  });
});
