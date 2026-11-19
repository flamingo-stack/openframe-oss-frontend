/**
 * The quick actions list follows the app's one table flag: the grid table where it is on, card rows where it is off,
 * a loading table until it is answered. One read-only column, so the grid has no settings gear and no height of its
 * own.
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridLoadingHeaderCells,
  gridMetaRow,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
} from '@/app/hooks/use-table-layout.fixtures';
import type { AiQuickAction } from '../types/ai-settings';

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

import { AiSettingsQuickActions, MINGO_QUICK_ACTIONS_CONFIG } from './ai-settings-quick-actions';

const ACTIONS: AiQuickAction[] = [
  { id: 'a-1', name: 'Summarize device', instructions: 'Give a short health summary of the device.' },
  { id: 'a-2', name: 'Draft a reply', instructions: 'Draft a reply to the customer.' },
];

const list = () =>
  mount(<AiSettingsQuickActions actions={ACTIONS} isDefault agentConfig={MINGO_QUICK_ACTIONS_CONFIG} />);

afterEach(() => {
  unmountAll();
  answerTableFlag('loading');
});

describe('AiSettingsQuickActions', () => {
  it('flag on: the grid table, one line an action, the count above it, no gear and no height of its own', () => {
    answerTableFlag('on');
    const { container } = list();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['name']);
    expect(gridMetaRow(container)?.textContent).toContain('2');
    // The count is drawn once, above the table: the grid header does not draw the card header's right slot.
    expect((container.textContent ?? '').match(/2 results/g)).toHaveLength(1);
    // The instructions follow the name on the row's one line.
    expect(container.querySelector('[data-part="secondary"]')?.textContent).toBe(
      'Give a short health summary of the device.',
    );
    expect(gridSettingsGear(container)).toBeNull();
    expect(gridViewport(container)).toBeNull();
  });

  it('flag off: card rows, nothing of the grid', () => {
    answerTableFlag('off');
    const { container } = list();

    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).toContain('Summarize device');
    expect(container.textContent).toContain('Give a short health summary of the device.');
  });

  it('flag not answered: a loading table, no action drawn yet in either layout', () => {
    answerTableFlag('loading');
    const { container } = list();

    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).not.toContain('Summarize device');
  });

  it('flag on, in a loading scope: the grid table with a loading header, as the loaded one will be', () => {
    answerTableFlag('on');
    const { container } = mount(
      <LoadingScope>
        <AiSettingsQuickActions actions={[]} agentConfig={MINGO_QUICK_ACTIONS_CONFIG} />
      </LoadingScope>,
    );

    expect(gridRoot(container)).not.toBeNull();
    expect(gridLoadingHeaderCells(container).length).toBeGreaterThan(0);
  });
});
