/**
 * The USER and SOURCES cells come from their own fragment, which only Tenant Management Phase 2's list spreads: each
 * listed row must carry its own machine's cells, and a null edge must not shift them onto the next row.
 */

import { describe, expect, it, vi } from 'vitest';

// Vitest runs no Relay Babel transform, so the tag resolves to its compiled artifact, as the transform makes it.
vi.mock('react-relay', async importOriginal => {
  const artifact = (await import('@/__generated__/deviceDirectoryFields_machine.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return { ...actual.default, ...actual, graphql: () => artifact };
});

// The listed row is `readListedMachineEdges`'s, tested with the ladder; what is under test is the merge.
vi.mock('./read-machine', () => ({
  readListedMachineEdges: (edges: { node: { id: string; unreadNotificationCount: number } }[]) =>
    edges.map(({ node }) => ({ id: node.id, unreadNotificationCount: node.unreadNotificationCount })),
}));

import { machineDirectoryToDevice, readDirectoryListedMachineEdges } from './device-directory-transform';

/** A listed node as Relay hands it over: the inline fragment's data under its name. */
function listedNode(id: string, directory: Record<string, unknown>) {
  return {
    id,
    unreadNotificationCount: 1,
    __fragments: { deviceDirectoryFields_machine: directory },
  } as never;
}

const SHARED = {
  directorySources: ['MICROSOFT_365', 'GOOGLE_WORKSPACE'],
  directoryUserLink: 'SHARED',
  directoryUserIds: ['a1', 'a2', 'a3'],
  directoryUserName: null,
};
const PRIMARY = {
  directorySources: ['MICROSOFT_365'],
  directoryUserLink: 'PRIMARY',
  directoryUserIds: ['a9'],
  directoryUserName: 'Ada Lovelace',
};

describe('the directory cells of a listed device', () => {
  it('counts the tied users and keeps the sources, link and name', () => {
    expect(machineDirectoryToDevice(listedNode('d1', SHARED))).toEqual({
      directorySources: ['MICROSOFT_365', 'GOOGLE_WORKSPACE'],
      directoryUserLink: 'SHARED',
      directoryUserName: null,
      directoryUserCount: 3,
    });
  });

  it("merges each row with its own machine's cells, skipping a null edge", () => {
    const rows = readDirectoryListedMachineEdges([
      { node: listedNode('d1', SHARED) },
      null,
      { node: listedNode('d2', PRIMARY) },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'd1',
        unreadNotificationCount: 1,
        directoryUserLink: 'SHARED',
        directoryUserCount: 3,
      }),
      expect.objectContaining({ id: 'd2', directoryUserLink: 'PRIMARY', directoryUserName: 'Ada Lovelace' }),
    ]);
  });
});
