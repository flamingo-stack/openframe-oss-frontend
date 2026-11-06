/**
 * The top-up grid per surface (CU-17tkuw646a9): the paywall's prepaid year offers
 * "Don't top up" / $20 / $50 / Custom, pay-as-you-go $20 / $50 / $100 / Custom,
 * and a choice the grid drawn now has no tile for reads as the opening one.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AiTopUp, CUSTOM_TOP_UP, NO_TOP_UP, TOP_UP_PRESETS_USD, useAiTopUp } from './use-ai-top-up';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: () => ({}) }));

const YEAR_PRESETS = [20, 50];

let container: HTMLDivElement;
let root: Root;
let latest: AiTopUp;
const capture = (topUp: AiTopUp) => {
  latest = topUp;
};

function Probe({ year, onRender }: { year: boolean; onRender: (topUp: AiTopUp) => void }) {
  onRender(
    useAiTopUp({
      tokenPrice: 0.00001,
      initial: 50,
      presets: year ? YEAR_PRESETS : TOP_UP_PRESETS_USD,
      allowNone: year,
    }),
  );
  return null;
}

const render = (year: boolean) => act(() => root.render(<Probe year={year} onRender={capture} />));

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

describe('useAiTopUp grid', () => {
  it('offers "Don\'t top up" only where allowed, as a complete choice of nothing', () => {
    render(true);
    expect(latest.allowNone).toBe(true);
    expect(latest.presets).toEqual([20, 50]);
    act(() => latest.selectNone());
    expect(latest.selection).toBe(NO_TOP_UP);
    expect(latest.amountUsd).toBe(0);
    expect(latest.tokens).toBeNull();
    expect(latest.isComplete).toBe(true);
    expect(latest.validate()).toBeNull();
  });

  it('opens on the initial amount when the grid switches under a choice it lacks, and restores it on the way back', () => {
    render(true);
    act(() => latest.selectNone());

    render(false);
    expect(latest.allowNone).toBe(false);
    expect(latest.presets).toEqual([20, 50, 100]);
    expect(latest.selection).toBe(50);

    render(true);
    expect(latest.selection).toBe(NO_TOP_UP);
  });

  it('drops $100 for the prepaid year and keeps a custom amount across both grids', () => {
    render(false);
    act(() => latest.selectPreset(100));
    render(true);
    expect(latest.selection).toBe(50);
    expect(latest.amountUsd).toBe(50);

    act(() => latest.selectCustom());
    act(() => latest.setCustomUsd('150'));
    render(false);
    expect(latest.selection).toBe(CUSTOM_TOP_UP);
    expect(latest.amountUsd).toBe(150);
  });
});
