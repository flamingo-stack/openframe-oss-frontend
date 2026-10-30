/**
 * The sidebar controls of the Mingo-first shell: the lib's compact time tracker and bell
 * beside the account row (support replies are in the account menu). They mount only where the sidebar owns them (md
 * up) — a second tracker would open a second panel — and the tracker's panel opens beside
 * the sidebar.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoSidebarControls } from './mingo-sidebar-controls';

const { seen } = vi.hoisted(() => ({
  seen: {
    tracker: [] as Array<Record<string, unknown>>,
    bell: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  TimeTrackerHeaderButton: (props: Record<string, unknown>) => {
    seen.tracker.push(props);
    return null;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  NotificationsBellButton: (props: Record<string, unknown>) => {
    seen.bell.push(props);
    return null;
  },
}));

let container: HTMLDivElement;
let root: Root;

function render(props: { ownsHeaderCells?: boolean; disabled?: boolean }) {
  seen.tracker = [];
  seen.bell = [];
  act(() =>
    root.render(
      <MingoSidebarControls ownsHeaderCells={props.ownsHeaderCells ?? true} disabled={props.disabled ?? false} />,
    ),
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoSidebarControls', () => {
  it('draws the tracker and the bell as the compact buttons', () => {
    render({});
    expect(seen.tracker.at(-1)).toMatchObject({
      variant: 'compact',
      popoverSide: 'right',
      popoverAlign: 'end',
      disabled: false,
    });
    expect(seen.bell.at(-1)).toMatchObject({ variant: 'compact', disabled: false });
  });

  it('leaves the controls to the phone top bar until the sidebar owns them', () => {
    render({ ownsHeaderCells: false });
    expect(seen.tracker).toHaveLength(0);
    expect(seen.bell).toHaveLength(0);
  });

  it('disables every control behind the lock screen', () => {
    render({ disabled: true });
    for (const props of [seen.tracker.at(-1), seen.bell.at(-1)]) {
      expect(props).toMatchObject({ disabled: true });
    }
  });
});
