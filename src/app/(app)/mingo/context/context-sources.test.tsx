// Pins which picker entries a module's flag brings: an Incident is offered only
// while `insights` holds, Software/Vulnerability only while `software-management`
// does, and "not answered yet" reads as absent, never as present.

import type { ChatContextEntityType } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { MINGO_CONTEXT_ENTITY_TYPES, useMingoContextEntityTypes } from './context-sources';
import { CONTEXT_ENTITY_KIND } from './context-types';

let container: HTMLDivElement;
let root: Root;
let latest: ChatContextEntityType[] | null = null;

function Probe() {
  const types = useMingoContextEntityTypes();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = types;
  });
  return null;
}

const kinds = () => latest?.map(t => t.type) ?? [];

/** The kinds a module's flag brings — everything else is always offered. */
const GATED = new Set<string>([
  CONTEXT_ENTITY_KIND.INSIGHT,
  CONTEXT_ENTITY_KIND.SOFTWARE,
  CONTEXT_ENTITY_KIND.VULNERABILITY,
]);
const ALWAYS_ON = MINGO_CONTEXT_ENTITY_TYPES.map(t => t.type).filter(kind => !GATED.has(kind));

describe('useMingoContextEntityTypes', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

  it('offers only the always-on kinds until the flags have answered', () => {
    expect(kinds()).toEqual(ALWAYS_ON);
  });

  it('adds Incident with `insights` alone', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]));
    expect(kinds()).toEqual([...ALWAYS_ON, CONTEXT_ENTITY_KIND.INSIGHT]);
  });

  it('adds Software and Vulnerability with `software-management` alone', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'software-management', enabled: true }]));
    expect(kinds()).toEqual([...ALWAYS_ON, CONTEXT_ENTITY_KIND.SOFTWARE, CONTEXT_ENTITY_KIND.VULNERABILITY]);
  });

  it('offers the full list, in picker order, with both flags on', () => {
    act(() =>
      useFeatureFlagsStore.getState().setFlags([
        { name: 'insights', enabled: true },
        { name: 'software-management', enabled: true },
      ]),
    );
    expect(kinds()).toEqual(MINGO_CONTEXT_ENTITY_TYPES.map(t => t.type));
  });

  it('drops Incident again on an explicit server "off"', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]));
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: false }]));
    expect(kinds()).toEqual(ALWAYS_ON);
  });
});
