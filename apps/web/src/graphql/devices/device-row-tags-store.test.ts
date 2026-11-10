/**
 * The bug this guards (CU-17tkuw628nw): `Machine.tags` carried each device's values under the tag DEFINITION's id,
 * so Relay kept one `Tag` record for every device sharing a tag and the last device read won. The row fragment now
 * reads `tagAssignments`, whose `MachineTag` id is unique per (device, tag). This normalizes a real response through
 * the generated query artifact into a real store and checks that both devices keep their own values.
 */
import { createOperationDescriptor, Environment, Network, RecordSource, Store } from 'relay-runtime';
import { describe, expect, it } from 'vitest';
import scriptScheduleDevicesRelayQuery from '@/__generated__/scriptScheduleDevicesRelayQuery.graphql';

const ENV_TAG = { id: 'Tag:env', key: 'env', description: null, color: '#ff0000' };

function machine(id: string, value: string) {
  return {
    __typename: 'Machine',
    id: `Machine:${id}`,
    machineId: id,
    hostname: id,
    displayName: id,
    nickname: null,
    osType: 'WINDOWS',
    status: 'ONLINE',
    lastSeen: null,
    type: 'DESKTOP',
    organization: null,
    tagAssignments: [{ id: `MachineTag:${id}-env`, values: [value], taggedAt: null, tag: ENV_TAG }],
  };
}

function normalize(machines: ReturnType<typeof machine>[]): RecordSource {
  const source = new RecordSource();
  const environment = new Environment({
    network: Network.create(() => Promise.reject(new Error('no network in this test'))),
    store: new Store(source),
  });
  const operation = createOperationDescriptor(scriptScheduleDevicesRelayQuery, { id: 'Schedule:1', first: 25 });
  environment.commitPayload(operation, {
    scriptSchedule: {
      id: 'Schedule:1',
      deviceCount: machines.length,
      assignedDevices: {
        filteredCount: machines.length,
        edges: machines.map((node, i) => ({ node, cursor: String(i) })),
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
  return source;
}

function valuesOf(source: RecordSource, machineId: string): unknown {
  const assignmentRefs = source.get(`Machine:${machineId}`)?.tagAssignments as { __refs: string[] };
  return assignmentRefs.__refs.map(ref => source.get(ref)?.values);
}

describe('device tags in the Relay store', () => {
  it('keeps one record per device tag, so devices sharing a tag keep their own values', () => {
    const source = normalize([machine('a', 'staging'), machine('b', 'prod')]);

    expect(valuesOf(source, 'a')).toEqual([['staging']]);
    expect(valuesOf(source, 'b')).toEqual([['prod']]);
  });

  it('still shares the tag definition between the devices', () => {
    const source = normalize([machine('a', 'staging'), machine('b', 'prod')]);
    const tagOf = (id: string) => (source.get(`MachineTag:${id}-env`)?.tag as { __ref: string }).__ref;

    expect(tagOf('a')).toBe('Tag:env');
    expect(tagOf('b')).toBe('Tag:env');
    expect(source.get('Tag:env')).toMatchObject({ key: 'env', color: '#ff0000' });
    expect(source.get('Tag:env')).not.toHaveProperty('values');
  });
});
