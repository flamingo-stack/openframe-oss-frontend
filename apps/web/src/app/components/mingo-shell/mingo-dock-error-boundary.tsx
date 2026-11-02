'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Component, type ReactNode } from 'react';

/**
 * The composer dock's guard: a crash in the chat (the lib panel, or the session's
 * chat state rethrown by the dock) shows "Mingo is unavailable" in the dock's place
 * instead of taking the shell with it, with a retry, because the dock cannot be
 * closed and reopened.
 *
 * Retry remounts the dock. A crashed chat STATE recovers with it: the crash
 * unmounted the dock, the last surface, so the provider has already dropped the
 * failed state, and the remount starts a fresh one.
 */
export class MingoDockErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[MingoComposerDock] chat crashed:', error);
  }

  retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="flex items-center justify-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)] text-center"
        >
          <p className="text-ods-text-secondary text-h6">Mingo is unavailable right now.</p>
          <Button variant="outline" size="small" onClick={this.retry}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
