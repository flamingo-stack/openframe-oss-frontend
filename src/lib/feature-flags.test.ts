import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { featureFlags, whenFeatureFlagsResolved } from './feature-flags';

afterEach(() => {
  useFeatureFlagsStore.getState().reset();
});

/**
 * The window between app start and the flags answer is a REAL state, not a
 * transient (flags are deliberately uncached — see `feature-flags-store.ts`).
 * `featureFlags.*.enabled()` reports the fallback inside it, which is why
 * anything that KEEPS its answer has to wait for this instead.
 */
describe('whenFeatureFlagsResolved', () => {
  it('does not settle while the server has not answered', async () => {
    const settled = vi.fn();
    void whenFeatureFlagsResolved().then(settled);

    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    // And the imperative read is exactly the wrong answer for that window.
    expect(featureFlags.mingoRemoteTools.enabled()).toBe(false);
  });

  it('settles when the flags land, with the real value readable', async () => {
    const pending = whenFeatureFlagsResolved();
    useFeatureFlagsStore.getState().setFlags([{ name: 'ai-mingo-remote-tools', enabled: true }]);

    await expect(pending).resolves.toBeUndefined();
    expect(featureFlags.mingoRemoteTools.enabled()).toBe(true);
  });

  it('settles on a terminal failure, which marks the flags loaded with no values', async () => {
    const pending = whenFeatureFlagsResolved();
    useFeatureFlagsStore.getState().setLoaded();

    await expect(pending).resolves.toBeUndefined();
    expect(featureFlags.mingoRemoteTools.enabled()).toBe(false);
  });

  it('settles immediately once the answer is already in', async () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'ai-mingo-remote-tools', enabled: true }]);
    await expect(whenFeatureFlagsResolved()).resolves.toBeUndefined();
  });
});
