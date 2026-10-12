'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type AgentInstallError,
  canInstallAgentLocally,
  onLocalAgentInstallDone,
  onLocalAgentInstallOutput,
  startLocalAgentInstall,
} from '@/lib/native-shell';

export type LocalInstallStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export interface LocalAgentInstall {
  /** The desktop shell is here to run the command; false on the web and the phone. */
  supported: boolean;
  status: LocalInstallStatus;
  /** What the installer printed so far, in order. Cleared by the next start. */
  lines: string[];
  /** Why the last run failed, or null. */
  error: AgentInstallError | null;
  /** Run `command` on this machine behind the administrator prompt. */
  start: (command: string) => Promise<void>;
}

/**
 * "Deploy on this Device": the shell's local install, as page state. The shell
 * owns the run (elevation, the process, the log file) and reports through
 * events; this keeps the lines and the outcome for the screen that started it.
 */
export function useLocalAgentInstall(): LocalAgentInstall {
  // Read once per mount: the shell is decided before the page loads.
  const [supported] = useState(canInstallAgentLocally);
  const [status, setStatus] = useState<LocalInstallStatus>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<AgentInstallError | null>(null);

  useEffect(() => {
    if (!supported) return undefined;
    // The bridge keeps its listeners for the document's life; this flag keeps a
    // run that outlives the screen from updating state it no longer has.
    let live = true;
    void onLocalAgentInstallOutput(incoming => {
      if (live) setLines(previous => [...previous, ...incoming]);
    });
    void onLocalAgentInstallDone(done => {
      if (!live) return;
      setStatus(done.success ? 'succeeded' : 'failed');
      setError(done.error ?? null);
    });
    return () => {
      live = false;
    };
  }, [supported]);

  const start = useCallback(async (command: string) => {
    setLines([]);
    setError(null);
    setStatus('running');
    try {
      await startLocalAgentInstall(command);
    } catch (caught) {
      setStatus('failed');
      setError(caught as AgentInstallError);
    }
  }, []);

  return { supported, status, lines, error, start };
}
