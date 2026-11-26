/**
 * The app's device picker (`DevicePicker`, over the lib's `DeviceSelector`) follows the app's one table flag: the grid
 * table where it is on, card rows where it is off, and its loading form until the flag is answered, so a picker never
 * draws one layout and swaps to the other.
 *
 * Every picker in the app goes through it, its loading forms included: the last test reads the sources, so a new
 * picker that renders the lib's selector directly (and so stays on card rows with the flag on) fails here.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { DeviceRow } from '@flamingo-stack/openframe-frontend-core/components/features';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerTableFlag,
  gridLoadingHeaderCells,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';
import { DEVICE_PICKER_TABLE_KEY, DevicePicker } from './device-picker';

vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://tenant.example' } }));

const DEVICES: DeviceRow[] = [
  {
    id: 'd-1',
    machineId: 'm-1',
    status: 'MANAGED',
    connectivity: 'ONLINE',
    hostname: 'reception-01',
    nickname: null,
    type: 'desktop',
  },
  {
    id: 'd-2',
    machineId: 'm-2',
    status: 'MANAGED',
    connectivity: 'OFFLINE',
    hostname: 'maya-mba',
    nickname: null,
    type: 'laptop',
  },
];

const picker = (props: { loading?: boolean } = {}) => (
  <DevicePicker
    tableStorageKey={DEVICE_PICKER_TABLE_KEY.policy}
    devices={props.loading ? [] : DEVICES}
    loading={props.loading ?? false}
    showSelectionModeRadio={false}
  />
);

describe('DevicePicker', () => {
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
    window.localStorage.clear();
  });

  it('draws card rows while the flag is off', () => {
    answerTableFlag('off');
    draw(picker());
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).toContain('reception-01');
  });

  it('draws the grid table while the flag is on, with the gear of its saved column layout', () => {
    answerTableFlag('on');
    draw(picker());
    expect(gridRoot(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
    expect(container.textContent).toContain('reception-01');
  });

  it('has no height of its own: the form scrolls, not the table', () => {
    answerTableFlag('on');
    draw(picker());
    expect(gridViewport(container)).toBeNull();
  });

  it('draws its loading form until the flag is answered: no device and no layout to swap', () => {
    answerTableFlag('loading');
    draw(picker());
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).not.toContain('reception-01');
    expect(container.querySelectorAll('[data-loading-item]').length).toBeGreaterThan(0);

    // The answer arrives: the same picker, now the grid, with its devices.
    act(() => answerTableFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(container.textContent).toContain('reception-01');
  });

  it('draws a host’s loading form in the layout the loaded picker will draw', () => {
    answerTableFlag('on');
    draw(picker({ loading: true }));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridLoadingHeaderCells(container).length).toBeGreaterThan(0);

    act(() => answerTableFlag('off'));
    expect(hasGridMarkup(container)).toBe(false);
  });

  it('gives every picker a saved-layout key of its own', () => {
    const keys = Object.values(DEVICE_PICKER_TABLE_KEY);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/** Every `.ts` / `.tsx` file under `dir` that is not a test. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__generated__' ? [] : sourceFiles(file);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

describe('the lib’s DeviceSelector', () => {
  it('is rendered only through DevicePicker, so no picker is left on card rows with the flag on', () => {
    const src = path.resolve(__dirname, '../../../..');
    const renders = sourceFiles(src)
      .filter(file => /<DeviceSelector[\s<>]/.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(src, file));
    expect(renders).toEqual(['app/components/shared/device-selector/device-picker.tsx']);
  });
});
