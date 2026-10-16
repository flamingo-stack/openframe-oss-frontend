/**
 * The sidebar header controls of the Mingo-first shell: the lib's compact time tracker,
 * bell and ticket alerts. The tracker and the alerts mount only where the sidebar owns
 * them (md up) — a second tracker would open a second panel — and the tracker's panel
 * opens to the right of the 56px rail.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoHeaderControls } from './mingo-header-controls';

const { seen } = vi.hoisted(() => ({
  seen: {
    tracker: [] as Array<Record<string, unknown>>,
    bell: [] as Array<Record<string, unknown>>,
    alerts: [] as Array<Record<string, unknown>>,
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
  TicketAlertsButton: (props: Record<string, unknown>) => {
    seen.alerts.push(props);
    return null;
  },
}));

const onTicketAlerts = vi.fn();
let container: HTMLDivElement;
let root: Root;

function render(props: { minimized?: boolean; ownsHeaderCells?: boolean; disabled?: boolean }) {
  seen.tracker = [];
  seen.bell = [];
  seen.alerts = [];
  act(() =>
    root.render(
      <MingoHeaderControls
        minimized={props.minimized ?? false}
        ownsHeaderCells={props.ownsHeaderCells ?? true}
        disabled={props.disabled ?? false}
        onTicketAlerts={onTicketAlerts}
      />,
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

describe('MingoHeaderControls', () => {
  it('draws the three controls as the compact buttons', () => {
    render({});
    expect(seen.tracker.at(-1)).toMatchObject({ variant: 'compact', popoverSide: 'bottom', disabled: false });
    expect(seen.bell.at(-1)).toMatchObject({ variant: 'compact', disabled: false });
    expect(seen.alerts.at(-1)).toMatchObject({
      variant: 'compact',
      href: routes.helpCenter.tickets,
      onNavigate: onTicketAlerts,
    });
  });

  it('opens the tracker panel to the right of the rail', () => {
    render({ minimized: true });
    expect(seen.tracker.at(-1)).toMatchObject({ popoverSide: 'right' });
  });

  it('leaves the tracker and the alerts to the phone top bar until the sidebar owns them', () => {
    render({ ownsHeaderCells: false });
    expect(seen.tracker).toHaveLength(0);
    expect(seen.alerts).toHaveLength(0);
    expect(seen.bell).not.toHaveLength(0);
  });

  it('disables every control behind the lock screen', () => {
    render({ disabled: true });
    for (const props of [seen.tracker.at(-1), seen.bell.at(-1), seen.alerts.at(-1)]) {
      expect(props).toMatchObject({ disabled: true });
    }
  });
});
