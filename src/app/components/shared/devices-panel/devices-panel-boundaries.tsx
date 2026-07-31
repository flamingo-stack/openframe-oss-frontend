'use client';

import { PageError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Component, type ReactNode } from 'react';
import { DevicesTableBody } from '@/app/(app)/devices/components/devices-table-columns';
// Direct import, not the `@/app/components/shared` barrel: that barrel re-exports
// `DevicesPanel`, which imports this file, and the cycle only resolves by luck.
import { SearchBarSkeleton } from '../page-skeleton-primitives';

const NO_DEVICES: never[] = [];

export interface DevicesPanelChrome {
  title: string;
  backButton?: { label?: string; onClick: () => void };
  className?: string;
  offsetClassName?: string;
}

/**
 * Suspense fallback for `DevicesPanel`.
 *
 * Renders the REAL pieces the loaded panel uses — its `PageLayout` header, the
 * filter toolbar row, and `DevicesTableBody` in `isLoading` mode — so the column
 * set comes from the actual table definition and can't drift. Header actions are
 * omitted rather than faked: they depend on data this fallback doesn't have, and
 * a disabled button that shifts on load is worse than one that appears with it.
 */
export function DevicesPanelSkeleton({ title, backButton, className, offsetClassName }: DevicesPanelChrome) {
  return (
    <PageLayout
      title={title}
      backButton={backButton}
      actionsVariant="icon-buttons"
      className={cn(offsetClassName, className)}
      contentClassName="flex flex-col"
    >
      <div>
        <SearchBarSkeleton />
        <DevicesTableBody devices={NO_DEVICES} isLoading emptyMessage="" skeletonRows={10} deviceFilters={null} />
      </div>
    </PageLayout>
  );
}

interface BoundaryProps extends DevicesPanelChrome {
  /**
   * Changing this clears a tripped boundary. The panel feeds it the active
   * filter + search, so retrying is "narrow the list differently" — the same
   * gesture that would have refetched before, rather than a dead end that only
   * a remount escapes.
   */
  resetKey: string;
  children: ReactNode;
}

interface BoundaryState {
  message: string | null;
  resetKey: string;
}

/**
 * Keeps a failed device query inside the panel.
 *
 * The Relay hooks throw on failure instead of returning an `error` string, and
 * without a boundary that throw reaches Next's route-level `error.tsx` and
 * replaces the whole page. This preserves the previous behaviour: the page
 * chrome stays, the list area shows the error.
 */
export class DevicesPanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { message: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'Failed to load devices' };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    return { message: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    console.error('[DevicesPanel] device query failed:', error);
  }

  render() {
    const { children, title, backButton, className, offsetClassName } = this.props;
    if (this.state.message === null) return children;

    return (
      <PageLayout
        title={title}
        backButton={backButton}
        actionsVariant="icon-buttons"
        className={cn(offsetClassName, className)}
        contentClassName="flex flex-col"
      >
        <PageError message={this.state.message} />
      </PageLayout>
    );
  }
}
