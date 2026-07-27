'use client';

import {
  Button,
  NoData,
  QueryReportTable,
  type QueryResultRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core';
import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  FlaskVialIcon,
  SearchIcon,
  XmarkCircleIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatTime } from '@/lib/format-date';
import type { Device } from '../../devices/types/device.types';
import { getFleetHostId } from '../../devices/utils/device-action-utils';
import { useLiveCampaign } from '../hooks/use-live-campaign';

export interface TestQuerySectionProps {
  /** Returns the current osquery SQL from the form. */
  getQuery: () => string;
  hasQuery: boolean;
  devices: Device[];
  isLoadingDevices: boolean;
  className?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * "Test Query" block rendered directly under the Query editor: a small toggle
 * button (Test Query / Cancel Test) with the Osquery Documentation link on the
 * same row, and an expandable panel with a single-device selector, run timing,
 * and the live result table. Lets the user test a query before it is saved or
 * assigned to any device.
 */
export function TestQuerySection({ getQuery, hasQuery, devices, isLoadingDevices, className }: TestQuerySectionProps) {
  const campaign = useLiveCampaign();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHostId, setSelectedHostId] = useState<string>('');
  // Sticky "a run has been started" flag: campaignStatus resets to '' for a
  // moment when a new run starts, which would flash "Run Test" between
  // "Test Again" clicks without it.
  const [hasRun, setHasRun] = useState(false);

  // Only Fleet-connected devices can run a live query.
  const selectableDevices = useMemo(
    () =>
      devices
        .filter(d => getFleetHostId(d) !== undefined)
        .sort((a, b) => (a.displayName || a.hostname || '').localeCompare(b.displayName || b.hostname || '')),
    [devices],
  );

  const [durationMs, setDurationMs] = useState(0);
  useEffect(() => {
    if (!campaign.startedAt || !campaign.isRunning) {
      if (campaign.startedAt && !campaign.isRunning) {
        setDurationMs(Date.now() - campaign.startedAt.getTime());
      }
      return;
    }
    setDurationMs(Date.now() - campaign.startedAt.getTime());
    const interval = setInterval(() => {
      setDurationMs(Date.now() - campaign.startedAt!.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [campaign.startedAt, campaign.isRunning]);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      // Cancel Test: stop anything in flight and reset the panel state.
      campaign.stopCampaign();
      setSelectedHostId('');
      setDurationMs(0);
      setHasRun(false);
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, [isOpen, campaign]);

  const handleRun = useCallback(() => {
    const hostId = Number(selectedHostId);
    if (!Number.isFinite(hostId) || hostId <= 0) return;
    setHasRun(true);
    setDurationMs(0);
    campaign.startCampaign(getQuery(), [hostId]);
  }, [campaign, getQuery, selectedHostId]);

  const isFinished = campaign.campaignStatus === 'finished';
  const showResults = campaign.isRunning || (hasRun && isFinished);
  const canRun = hasQuery && selectedHostId !== '' && !campaign.isRunning;

  const firstError = isFinished && campaign.errors.length > 0 ? campaign.errors[0].error : null;

  // Started/Duration show zeros until the current run's timing is real:
  // hasRun=false after Cancel Test, and campaignStatus resets while the next
  // Test Again run is being created, so stale values never linger on screen.
  const showTiming = hasRun && campaign.startedAt !== null && (campaign.isRunning || isFinished);

  // Humanize the raw osquery keys for the table headers (snake_case -> spaced
  // words); the row data itself is shown exactly as returned by the query.
  const displayRows = useMemo<QueryResultRow[]>(
    () =>
      campaign.results.map(row =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_/g, ' '), value])),
      ),
    [campaign.results],
  );

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
          className="inline-flex items-center gap-1.5 text-h6 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
        >
          <InfoCircleIcon size={16} />
          Osquery Documentation
        </a>
      </div>

      {/* Test panel */}
      {isOpen && (
        <div className="rounded-[6px] border border-ods-border overflow-clip">
          <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-[var(--spacing-system-m)] items-end px-[var(--spacing-system-m)] py-[var(--spacing-system-s)]">
            {/* Device */}
            <div className="flex flex-col gap-[var(--spacing-system-xxs)] min-w-0 order-1">
              <span className="text-h4 text-ods-text-primary">Device</span>
              <Select value={selectedHostId} onValueChange={setSelectedHostId} disabled={campaign.isRunning}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingDevices ? 'Loading devices...' : 'Select Device'} />
                </SelectTrigger>
                <SelectContent>
                  {selectableDevices.map(device => {
                    const fleetId = getFleetHostId(device);
                    return (
                      <SelectItem key={fleetId} value={String(fleetId)}>
                        {device.displayName || device.hostname}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Started */}
            <div className="flex flex-col justify-center min-w-0 order-3 lg:order-2">
              <span className="text-h4 text-ods-text-secondary truncate">
                {showTiming && campaign.startedAt ? formatTime(campaign.startedAt) : '00:00 PM'}
              </span>
              <span className="text-h6 text-ods-text-secondary truncate">Started</span>
            </div>

            {/* Duration */}
            <div className="flex flex-col justify-center min-w-0 order-4 lg:order-3">
              <span className="text-h4 text-ods-text-secondary truncate">
                {showTiming ? formatDuration(durationMs) : '00:00:00'}
              </span>
              <span className="text-h6 text-ods-text-secondary truncate">Duration</span>
            </div>

            {/* Action. The column is fixed-width on desktop and every button
                fills it (and matches the SelectTrigger height), so swapping
                Run Test / Stop Test / Test Again never shifts the layout. */}
            <div className="flex items-end justify-end order-2 lg:order-4 lg:w-[150px]">
              {campaign.isRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={campaign.stopCampaign}
                  leftIcon={<Square size={16} />}
                  className="w-full h-11 md:h-12"
                >
                  Stop Test
                </Button>
              ) : hasRun ? (
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
          {showResults && (
            <div className="border-t border-ods-border">
              {firstError && (
                <p className="px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-h6 text-ods-error">
                  {firstError}
                </p>
              )}
              {!campaign.isRunning && displayRows.length === 0 ? (
                // Fixed-height empty state matching the 1-row skeleton/result
                // height (48px header + 8px gap + 80px row) so the panel does
                // not jump between the loading, result, and empty transitions.
                <NoData icon={<SearchIcon />} title="No results returned" className="h-[136px] justify-center !py-0" />
              ) : (
                <QueryReportTable
                  title=""
                  data={displayRows}
                  loading={campaign.isRunning && displayRows.length === 0}
                  skeletonRows={1}
                  showExport={false}
                  variant="default"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
