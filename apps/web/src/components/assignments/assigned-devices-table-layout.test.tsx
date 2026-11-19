/**
 * The devices assigned to an item (the assignments panel) and the app's one table flag (`data-table-grid`): the panel
 * reads the flag once and hands the devices table its layout. The table itself is a stand-in that shows what it got.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { AssignedItemsContent } from './assigned-items-view';
import type { AssignedItemsResult } from './use-assigned-items';

const flags = vi.hoisted(() => ({ tableGrid: 'off' as FeatureFlagGate }));
vi.mock('@/app/hooks/use-table-layout', () => ({
  useTableGridGate: () => flags.tableGrid,
  tableLayoutFor: (gate: FeatureFlagGate) => (gate === 'on' ? 'grid' : 'cards'),
}));
vi.mock('react-relay', () => ({ graphql: () => null, useFragment: (_: unknown, ref: unknown) => ref }));
vi.mock('./tables/devices-assigned-table', () => ({
  DevicesAssignedTable: ({ tableLayout, isLoading }: { tableLayout?: string; isLoading?: boolean }) => (
    <div data-table={tableLayout} data-loading={isLoading ? 'yes' : 'no'} />
  ),
}));

const assigned = {
  value: { DEVICE: ['machine-1'] },
  devices: [{ id: 'mongo-1', machineId: 'machine-1' }],
  isLoading: false,
  loadingTypes: {},
  isReady: true,
  isOffline: false,
  failedTypes: {},
  loadFailed: false,
  retry: () => undefined,
} as unknown as AssignedItemsResult;

const draw = () => renderToStaticMarkup(<AssignedItemsContent assigned={assigned} itemType="KNOWLEDGE_ARTICLE" />);

describe('the assigned devices table and the table flag', () => {
  it('is the grid table while the flag is on', () => {
    flags.tableGrid = 'on';
    expect(draw()).toContain('data-table="grid" data-loading="no"');
  });

  it('stays card rows while the flag is off', () => {
    flags.tableGrid = 'off';
    expect(draw()).toContain('data-table="cards" data-loading="no"');
  });

  it('draws its loading rows, on card rows, while the flag is read', () => {
    flags.tableGrid = 'loading';
    expect(draw()).toContain('data-table="cards" data-loading="yes"');
  });
});
