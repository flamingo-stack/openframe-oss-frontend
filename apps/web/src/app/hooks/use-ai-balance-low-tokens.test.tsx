/**
 * Where "running low" starts: behind `mingo-chat-usage`. Off, the fixed 1M with nothing asked; on, the Auto Top-Up
 * level once it is read; unknown (null) until then, so no surface shows a yellow it takes back.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_BALANCE_LOW_TOKENS } from '@/lib/ai-balance-tone';
import { useAiBalanceLowTokens } from './use-ai-balance-low-tokens';

const { gate, query } = vi.hoisted(() => ({
  gate: { value: 'loading' as 'loading' | 'on' | 'off' },
  query: {
    enabled: [] as boolean[],
    answer: { data: {}, isLoading: true } as {
      data: { autoTopUpSettings?: { enabled: boolean; thresholdTokens: number | null } };
      isLoading: boolean;
    },
  },
}));

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('./use-feature-flag', () => ({ useFeatureFlagGate: () => gate.value }));
vi.mock('./use-non-suspending-query', () => ({
  useNonSuspendingQuery: (_query: unknown, _variables: unknown, enabled: boolean) => {
    query.enabled.push(enabled);
    return query.answer;
  },
}));

let container: HTMLDivElement;
let root: Root;
const last: { value: number | null | undefined } = { value: undefined };

function Probe() {
  const value = useAiBalanceLowTokens();
  useEffect(() => {
    last.value = value;
  });
  return null;
}

function read(): number | null | undefined {
  act(() => root.render(<Probe />));
  return last.value;
}

describe('useAiBalanceLowTokens', () => {
  beforeEach(() => {
    gate.value = 'loading';
    query.enabled = [];
    query.answer = { data: {}, isLoading: true };
    last.value = undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('is unknown while the flag is not answered, and asks nothing', () => {
    expect(read()).toBeNull();
    expect(query.enabled.every(e => !e)).toBe(true);
  });

  it('is the fixed 1M with the flag off, and asks nothing', () => {
    gate.value = 'off';
    expect(read()).toBe(AI_BALANCE_LOW_TOKENS);
    expect(query.enabled.every(e => !e)).toBe(true);
  });

  it('with the flag on, is unknown until the level is read, then the Auto Top-Up level', () => {
    gate.value = 'on';
    expect(read()).toBeNull();
    expect(query.enabled.at(-1)).toBe(true);

    query.answer = { data: { autoTopUpSettings: { enabled: true, thresholdTokens: 500_000 } }, isLoading: false };
    expect(read()).toBe(500_000);
  });
});
