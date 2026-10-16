import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { TestModeBanner } from './billing-section';

let container: HTMLDivElement;
let root: Root;

function renderBanner() {
  act(() => {
    root.render(<TestModeBanner />);
  });
  return container.textContent ?? '';
}

describe('TestModeBanner', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows when billing-test-mode is on', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'billing-test-mode', enabled: true }]);
    expect(renderBanner()).toContain('Test mode');
  });

  it('renders nothing when the flag is off', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'billing-test-mode', enabled: false }]);
    renderBanner();
    expect(container.childElementCount).toBe(0);
  });

  it('renders nothing until the flags answer', () => {
    expect(renderBanner()).toBe('');
  });
});
