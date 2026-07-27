'use client';

import { Button, SearchableSelect, TestRunResults, TimingStat } from '@flamingo-stack/openframe-frontend-core';
import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { FlaskVialIcon, XmarkCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { RotateCcw, Square } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { Device } from '../../devices/types/device.types';
import { getFleetHostId } from '../../devices/utils/device-action-utils';
import { useQueryTestRun } from './query-test-run';

export interface TestQuerySectionProps {
  /** Returns the current osquery SQL from the form. */
  getQuery: () => string;
  hasQuery: boolean;
  devices: Device[];
  isLoadingDevices: boolean;
  className?: string;
}

/**
 * "Test Query" block rendered directly under the Query editor: a small toggle
 * button (Test Query / Cancel Test) with the Osquery Documentation link on the
 * same row, and an expandable panel with a single-device selector, run timing,
 * and the live result table. Lets the user test a query before it is saved or
 * assigned to any device.
 */
export function TestQuerySection({ getQuery, hasQuery, devices, isLoadingDevices, className }: TestQuerySectionProps) {
  const test = useQueryTestRun();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHostId, setSelectedHostId] = useState<string>('');

  // Only Fleet-connected devices can run a live query.
  const deviceOptions = useMemo(
    () =>
      devices
        .filter(d => getFleetHostId(d) !== undefined)
        .sort((a, b) => (a.displayName || a.hostname || '').localeCompare(b.displayName || b.hostname || ''))
        .map(d => ({ value: String(getFleetHostId(d)), label: d.displayName || d.hostname || '' })),
    [devices],
  );

  const handleToggle = useCallback(() => {
    if (isOpen) {
      // Cancel Test: stop anything in flight and reset the panel state.
      test.reset();
      setSelectedHostId('');
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, [isOpen, test]);

  const handleRun = useCallback(() => {
    const hostId = Number(selectedHostId);
    if (!Number.isFinite(hostId) || hostId <= 0) return;
    test.run(getQuery(), [hostId]);
  }, [test, getQuery, selectedHostId]);

  const canRun = hasQuery && selectedHostId !== '' && !test.isActive;

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-xsf)]', className)}>
      {/* Toggle + docs link row */}
      <div className="flex items-center justify-between gap-[var(--spacing-system-m)]">
        <Button
          type="button"
          variant="outline"
          onClick={handleToggle}
          disabled={!isOpen && !hasQuery}
          leftIcon={isOpen ? <XmarkCircleIcon className="w-4 h-4" /> : <FlaskVialIcon className="w-4 h-4" />}
          className="!h-8 !px-[var(--spacing-system-xs)] !py-0 text-h5"
        >
          {isOpen ? 'Cancel Test' : 'Test Query'}
        </Button>
        <a
          href="https://osquery.io/schema"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-[var(--spacing-system-xxs)] text-h6 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
        >
          <InfoCircleIcon size={16} />
          Osquery Documentation
        </a>
      </div>

      {/* Test panel — one bordered box holding the controls row and, below
          it, the results (skeleton / table / empty state), per design. */}
      {isOpen && (
        <div className="flex flex-col gap-[var(--spacing-system-m)] rounded-[6px] border border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)]">
          <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-[var(--spacing-system-m)] items-end">
            {/* Device — searchable select (search field is the first dropdown
                item), same pattern as the ticket assignee picker. */}
            <div className="flex flex-col gap-[var(--spacing-system-xxs)] min-w-0 order-1">
              <span className="text-h4 text-ods-text-primary">Device</span>
              <SearchableSelect
                value={selectedHostId || null}
                onValueChange={setSelectedHostId}
                options={deviceOptions}
                placeholder={isLoadingDevices ? 'Loading devices...' : 'Select Device'}
                searchPlaceholder="Search for Device"
                emptyText="No devices found"
                isLoading={isLoadingDevices}
                disabled={test.isActive}
              />
            </div>

            <TimingStat value={test.startedLabel} label="Started" className="order-3 lg:order-2" />
            <TimingStat value={test.durationLabel} label="Duration" className="order-4 lg:order-3" />

            {/* Action. The column is fixed-width on desktop and every button
                fills it (and matches the SelectTrigger height), so swapping
                Run Test / Stop Test / Test Again never shifts the layout. */}
            <div className="flex items-end justify-end order-2 lg:order-4 lg:w-[150px]">
              {test.isActive ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={test.stop}
                  leftIcon={<Square size={16} />}
                  className="w-full h-11 md:h-12"
                >
                  Stop Test
                </Button>
              ) : test.hasRun ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRun}
                  disabled={!canRun}
                  leftIcon={<RotateCcw size={16} />}
                  className="w-full h-11 md:h-12"
                >
                  Test Again
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="accent"
                  onClick={handleRun}
                  disabled={!canRun}
                  className="w-full h-11 md:h-12"
                >
                  Run Test
                </Button>
              )}
            </div>
          </div>

          {/* Results */}
          {test.showResults && (
            <TestRunResults isActive={test.isActive} displayRows={test.displayRows} firstError={test.firstError} />
          )}
        </div>
      )}
    </div>
  );
}
