/**
 * The console's reporter: nothing goes out without a session, one queue
 * serves a session for as long as it lasts, and a new session gets its own.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSessionAction } from '../services/remote-session-actions-api-service';
import { useRemoteSessionActionReporter } from './use-remote-session-action-reporter';

const reporters = vi.hoisted(() => ({ created: [] as string[], reports: [] as [string, unknown][] }));

vi.mock('../services/remote-session-action-reporter', () => ({
  RemoteSessionActionReporter: class {
    constructor(private readonly sessionId: string) {
      reporters.created.push(sessionId);
    }
    report(action: unknown) {
      reporters.reports.push([this.sessionId, action]);
    }
  },
}));

/** What the probe hands out after each render. */
const probe: { report: (action: RemoteSessionAction) => void } = { report: () => {} };
const report = (action: RemoteSessionAction) => probe.report(action);

function Probe({ sessionId }: { sessionId: string | null }) {
  const reportAction = useRemoteSessionActionReporter(sessionId);
  useEffect(() => {
    probe.report = reportAction;
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  reporters.created = [];
  reporters.reports = [];
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useRemoteSessionActionReporter', () => {
  it('reports nothing without a session', () => {
    act(() => root.render(<Probe sessionId={null} />));
    report({ action: 'CTRL_ALT_DEL' });
    expect(reporters.created).toEqual([]);
    expect(reporters.reports).toEqual([]);
  });

  it('keeps one queue for a session and starts another for the next session', () => {
    act(() => root.render(<Probe sessionId="session-1" />));
    report({ action: 'INPUT_DISABLED' });
    report({ action: 'INPUT_ENABLED' });

    act(() => root.render(<Probe sessionId="session-2" />));
    report({ action: 'CTRL_ALT_DEL' });

    expect(reporters.created).toEqual(['session-1', 'session-2']);
    expect(reporters.reports).toEqual([
      ['session-1', { action: 'INPUT_DISABLED' }],
      ['session-1', { action: 'INPUT_ENABLED' }],
      ['session-2', { action: 'CTRL_ALT_DEL' }],
    ]);
  });
});
