/**
 * Pins that the AI Settings tab set is withheld until every flag shaping it has
 * answered: the page picks its starting tab from the first set it gets, so a
 * set with the flag-gated tabs still missing would strand a deep link.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { useVisibleAiSettingsTabs } from './ai-settings-tabs';

const { gates } = vi.hoisted(() => ({
  gates: { mingo: 'loading' as FeatureFlagGate, remoteAccess: 'loading' as FeatureFlagGate },
}));

vi.mock('@/app/hooks/use-feature-flag', () => ({
  useFeatureFlagGate: () => gates.mingo,
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
  it('answers nothing while either flag is still loading', () => {
    gates.mingo = 'loading';
    gates.remoteAccess = 'on';
    expect(render()).toBe('null');

    gates.mingo = 'on';
    gates.remoteAccess = 'loading';
    expect(render()).toBe('null');
  });

  it('answers the full set once both flags are on', () => {
    gates.mingo = 'on';
    gates.remoteAccess = 'on';
    expect(render()).toBe('mingo,customer,guardrails,device-guardrails');
  });

  it('leaves out the tabs whose flags are off', () => {
    gates.mingo = 'off';
    gates.remoteAccess = 'off';
    expect(render()).toBe('customer,guardrails');
  });
});
