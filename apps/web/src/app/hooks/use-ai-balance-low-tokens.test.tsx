import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useAiBalanceLowTokens } from './use-ai-balance-low-tokens';

const { query, platform } = vi.hoisted(() => ({ query: vi.fn(), platform: { kind: 'web' } }));

vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<object>()),
  isMobileShell: () => platform.kind === 'mobile',
  isDesktopShell: () => platform.kind === 'desktop',
}));

beforeEach(() => {
  platform.kind = 'web';
  query.mockClear();
});

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('./use-non-suspending-query', () => ({
  useNonSuspendingQuery: (...args: unknown[]) => {
    query(...args);
    return { data: { autoTopUpSettings: { enabled: true, thresholdTokens: 2_500_000 } } };
  },
}));

it('keeps the pre-feature low mark and stops the new query while Usage is disabled, even with cached data', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  let lowTokens = 0;
  function Probe() {
    lowTokens = useAiBalanceLowTokens();
    return null;
  }
  try {
    useFeatureFlagsStore.getState().reset();
    act(() => root.render(<Probe />));
    expect(lowTokens).toBe(1_000_000);
    expect(query).toHaveBeenLastCalledWith(expect.anything(), { list: true }, false);

    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled: true }]));
    expect(lowTokens).toBe(2_500_000);
    expect(query).toHaveBeenLastCalledWith(expect.anything(), { list: true }, true);

    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled: false }]));
    expect(lowTokens).toBe(1_000_000);
    expect(query).toHaveBeenLastCalledWith(expect.anything(), { list: true }, false);
  } finally {
    act(() => root.unmount());
    useFeatureFlagsStore.getState().reset();
  }
});

it.each(['mobile', 'desktop'])('gates the new Top-Up read in the %s shell', kind => {
  platform.kind = kind;
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() {
    useAiBalanceLowTokens();
    return null;
  }
  try {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-usage', enabled: true }]);
    act(() => root.render(<Probe />));
    expect(query).toHaveBeenLastCalledWith(expect.anything(), { list: true }, kind !== 'mobile');
  } finally {
    act(() => root.unmount());
    useFeatureFlagsStore.getState().reset();
  }
});
