/**
 * An incident's "Query Details" (the rows the finding was made from) follows the app's one table flag: the grid table
 * where the flag is on, card rows where it is off, and its loading rows until the flag is answered, so the section
 * never draws one layout and swaps to the other. Over the real component and the lib's `QueryReportTable`.
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridLoadingHeaderCells,
  gridRoot,
  gridSettingsGear,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';
import type { Incident } from '../utils/incident-transform';
import { IncidentQueryResults } from './incident-query-results';

/** An incident as the section reads it: only its evidence rows. */
const incidentWith = (queryResult: Incident['queryResult']) => ({ queryResult }) as Incident;

const EVIDENCE = incidentWith([
  { name: 'chrome', version: '120.0', path: '/Applications/Google Chrome.app' },
  { name: 'node', version: '22.1', path: '/usr/local/bin/node' },
]);

describe('IncidentQueryResults, by the table flag', () => {
  let container: HTMLDivElement;
  let root: Root;

  const draw = (element: ReactElement) => act(() => root.render(element));

  beforeEach(() => {
    stubLayoutApis();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    answerTableFlag('loading');
  });

  it('draws the evidence as the grid table while the flag is on, a column per field of the result', () => {
    answerTableFlag('on');
    draw(<IncidentQueryResults incident={EVIDENCE} />);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['name', 'version', 'path']);
    // The columns are the detecting query's own: no saved layout, so no gear.
    expect(gridSettingsGear(container)).toBeNull();
    expect(container.textContent).toContain('chrome');
  });

  it('draws card rows while the flag is off', () => {
    answerTableFlag('off');
    draw(<IncidentQueryResults incident={EVIDENCE} />);
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).toContain('chrome');
  });

  it('draws its loading rows until the flag is answered, then the grid: no layout to swap', () => {
    answerTableFlag('loading');
    draw(<IncidentQueryResults incident={EVIDENCE} />);
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).not.toContain('chrome');
    expect(container.querySelectorAll('[data-loading-item]').length).toBeGreaterThan(0);

    act(() => answerTableFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(container.textContent).toContain('chrome');
  });

  it('draws the grid’s loading form while the incident is read, with the flag on', () => {
    answerTableFlag('on');
    draw(<IncidentQueryResults />);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridLoadingHeaderCells(container)).toHaveLength(3);
  });

  it('keeps the section’s empty state in both layouts', () => {
    answerTableFlag('on');
    draw(<IncidentQueryResults incident={incidentWith(null)} />);
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).toContain('Evidence was not kept for this incident.');

    act(() => answerTableFlag('off'));
    expect(container.textContent).toContain('Evidence was not kept for this incident.');
  });
});
