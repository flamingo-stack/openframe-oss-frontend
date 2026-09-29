/**
 * Pins that the AI Settings tab set is withheld until the flag shaping it has
 * answered: the page picks its starting tab from the first set it gets, so a
 * set with the flag-gated tab still missing would strand a deep link.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { useVisibleAiSettingsTabs } from './ai-settings-tabs';

const { gates } = vi.hoisted(() => ({
  gates: { remoteAccess: 'loading' as FeatureFlagGate },
}));

vi.mock('@/app/(app)/devices/hooks/use-remote-access-approval-gate', () => ({
  useRemoteAccessApprovalGate: () => gates.remoteAccess,
}));

function Probe() {
  const tabs = useVisibleAiSettingsTabs();
  return <span data-tabs={tabs === null ? 'null' : tabs.map(tab => tab.id).join(',')} />;
}

let root: Root;
let container: HTMLDivElement;

function render() {
  act(() => root.render(<Probe />));
  return container.querySelector('span')?.getAttribute('data-tabs');
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useVisibleAiSettingsTabs', () => {
  it('answers nothing while the flag is still loading', () => {
    gates.remoteAccess = 'loading';
    expect(render()).toBe('null');
  });

  it('answers the full set once the flag is on', () => {
    gates.remoteAccess = 'on';
    expect(render()).toBe('mingo,customer,guardrails,device-guardrails');
  });

  it('leaves out the device guardrails tab when the flag is off', () => {
    gates.remoteAccess = 'off';
    expect(render()).toBe('mingo,customer,guardrails');
  });
});
