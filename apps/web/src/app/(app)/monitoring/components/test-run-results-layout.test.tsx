/**
 * The results of a live test run follow the app's one table flag in both places that draw them: the test section of a
 * policy's or a query's page (`TestQuerySection`) and the Quick Query panel under a device's row (`QuickQueryPanel`).
 * The grid table where the flag is on, card rows where it is off. Over the real hosts and the lib's `TestRunResults`,
 * with the run itself (a Fleet live query) given as a finished or a running one.
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridLoadingHeaderCells,
  gridRoot,
  gridSettingsGear,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';
import { QuickQueryPanel } from '../policy/components/quick-query-panel';
import { TestQuerySection } from './test-query-section';

/** The run the hosts read: what `useQueryTestRun` returns, in the state a test names. */
const run = vi.hoisted(() => {
  const rows = [
    { 'host display name': 'reception-01', pid: '1234', name: 'chrome' },
    { 'host display name': 'reception-01', pid: '5678', name: 'node' },
  ];
  const base = {
    hasRun: true,
    isFinished: true,
    showResults: true,
    status: 'success',
    firstError: null as string | null,
    startedLabel: '02:15 PM',
    durationLabel: '00:00:05',
    run: () => undefined,
    stop: () => undefined,
    reset: () => undefined,
  };
  return {
    finished: { ...base, isActive: false, displayRows: rows },
    running: { ...base, isFinished: false, status: 'running', isActive: true, displayRows: [] as typeof rows },
    current: null as unknown,
  };
});

vi.mock('./query-test-run', () => ({ useQueryTestRun: () => run.current }));
// The SQL editor is Monaco: nothing of it is under test here.
vi.mock('../../scripts/shared/components/script-editor', () => ({ ScriptEditor: () => null }));

const noQuery = () => 'select 1;';

describe('test run results, by the table flag', () => {
  let container: HTMLDivElement;
  let root: Root;

  const draw = (element: ReactElement) => act(() => root.render(element));
  const button = (name: string) =>
    [...container.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === name);

  beforeEach(() => {
    stubLayoutApis();
    run.current = run.finished;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    answerTableFlag('loading');
  });

  describe('the Quick Query panel of a device’s row', () => {
    const panel = <QuickQueryPanel fleetHostId={7} deviceName="reception-01" initialQuery="select 1;" />;

    it('draws the results as the grid table while the flag is on, a column per field of the result', () => {
      answerTableFlag('on');
      draw(panel);
      expect(gridRoot(container)).not.toBeNull();
      expect(gridHeaderColumns(container)).toEqual(['host display name', 'pid', 'name']);
      // The columns are the query's own: no saved layout, so no gear.
      expect(gridSettingsGear(container)).toBeNull();
      expect(container.textContent).toContain('chrome');
    });

    it('draws card rows while the flag is off', () => {
      answerTableFlag('off');
      draw(panel);
      expect(hasGridMarkup(container)).toBe(false);
      expect(container.textContent).toContain('chrome');
    });

    it('draws the grid’s loading rows while a run has returned nothing yet', () => {
      answerTableFlag('on');
      run.current = run.running;
      draw(panel);
      expect(gridRoot(container)).not.toBeNull();
      expect(gridLoadingHeaderCells(container).length).toBeGreaterThan(0);
    });
  });

  describe('the test section of a policy’s or a query’s page', () => {
    const section = <TestQuerySection getQuery={noQuery} hasQuery devices={[]} isLoadingDevices={false} />;

    it('draws the results as the grid table while the flag is on', () => {
      answerTableFlag('on');
      draw(section);
      // The results sit in the panel the toggle opens.
      expect(hasGridMarkup(container)).toBe(false);
      act(() => button('Test Query')?.click());
      expect(gridRoot(container)).not.toBeNull();
      expect(gridHeaderColumns(container)).toEqual(['host display name', 'pid', 'name']);
    });

    it('draws card rows while the flag is off', () => {
      answerTableFlag('off');
      draw(section);
      act(() => button('Test Query')?.click());
      expect(hasGridMarkup(container)).toBe(false);
      expect(container.textContent).toContain('chrome');
    });
  });
});
