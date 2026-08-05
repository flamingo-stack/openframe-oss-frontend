'use client';

import { Button, TestRunResults, TestRunStatusStat, TimingStat } from '@flamingo-stack/openframe-frontend-core';
import { RotateCcw, Square } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ScriptEditor } from '../../../scripts/components/script/script-editor';
import { useQueryTestRun } from '../../components/query-test-run';

export interface QuickQueryPanelProps {
  fleetHostId: number;
  /** Policy osquery SQL copied into the editable draft when the panel opens. */
  initialQuery: string;
}

/**
 * Per-device "Quick Query" panel expanded under a row of the policy Devices
 * table: an editable copy of the policy query (test-only — never saved back
 * to the policy), run timing, and the live result table for this one device.
 * The panel owns its own live campaign, so its state lives and dies with the
 * row it is opened on.
 */
export function QuickQueryPanel({ fleetHostId, initialQuery }: QuickQueryPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const test = useQueryTestRun();

  const canRun = Boolean(query.trim()) && !test.isActive;

  const handleRun = useCallback(() => {
    test.run(query, [fleetHostId]);
  }, [test, query, fleetHostId]);

  return (
    <div data-no-row-click className="flex flex-col bg-ods-bg">
      {/* Editable draft of the policy query, scoped to this test run. */}
      <div className="px-[var(--spacing-system-m)] pt-[var(--spacing-system-s)]">
        <ScriptEditor value={query} onChange={setQuery} shell="sql" height="240px" />
      </div>

      {/* Started | Duration | action — one row on every breakpoint, per design.
          Layout is shift-proof in both modes: on mobile the timing cells hold
          fixed quarter-of-row widths (per the mock) and the button keeps its
          natural, narrower width; from md up the action column is fixed at
          180px with w-full buttons. Either way, swapping Run / Stop / Test
          Again never moves Started/Duration horizontally. */}
      <div className="flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)]">
        <TimingStat value={test.startedLabel} label="Started" className="w-1/4 shrink-0 md:w-auto md:flex-1" />
        <TimingStat value={test.durationLabel} label="Duration" className="w-1/4 shrink-0 md:w-auto md:flex-1" />
        <TestRunStatusStat status={test.status} className="hidden md:flex md:flex-1" />
        <div className="ml-auto flex shrink-0 items-center justify-end md:w-[180px]">
          {test.isActive ? (
            <Button
              type="button"
              variant="outline"
              onClick={test.stop}
              leftIcon={<Square size={16} />}
              className="h-11 md:h-12 md:w-full"
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
              className="h-11 md:h-12 md:w-full"
            >
              Test Again
            </Button>
          ) : (
            <Button
              type="button"
              variant="accent"
              onClick={handleRun}
              disabled={!canRun}
              className="h-11 md:h-12 md:w-full"
            >
              Run Quick Query
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      {test.showResults && (
        <TestRunResults
          isActive={test.isActive}
          displayRows={test.displayRows}
          firstError={test.firstError}
          className="px-[var(--spacing-system-m)] pb-[var(--spacing-system-s)]"
        />
      )}
    </div>
  );
}
