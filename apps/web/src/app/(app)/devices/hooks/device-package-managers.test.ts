/**
 * `fetchDevicePackageManagers` must never break the device page: a backend that predates
 * `Machine.packageManagerDetails` refuses the query, and that reads as "no section" (null). Any other failure is
 * transient and throws, so the tab keeps what it last had.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDevicePackageManagers, isFieldMissingError } from './device-package-managers';

const relay = vi.hoisted(() => ({ fetchQuery: vi.fn() }));

// Vitest runs no Relay babel transform, so the graphql tag is stubbed; the query document is not under test.
vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('relay-runtime', () => ({ fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay/environment', () => ({ getRelayEnvironment: () => ({}) }));

/** The query answers with this result (a resolved payload or a refusal). */
function answers(result: Promise<unknown>) {
  relay.fetchQuery.mockReturnValue({ toPromise: () => result });
}

const MISSING_FIELD =
  "Validation error (FieldUndefined@[device/packageManagerDetails]) : Field 'packageManagerDetails' in type 'Machine' is undefined";

describe('fetchDevicePackageManagers', () => {
  beforeEach(() => relay.fetchQuery.mockReset());

  it('returns the reported managers, asked network-only for this machine', async () => {
    const entry = {
      type: 'CHOCO',
      state: 'PRESENT',
      managed: true,
      installing: false,
      version: '2.7.5',
      versionChangedAt: '2026-11-01T10:00:00Z',
    };
    answers(Promise.resolve({ device: { packageManagerDetails: [entry] } }));

    await expect(fetchDevicePackageManagers('machine-1')).resolves.toEqual([entry]);
    expect(relay.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { machineId: 'machine-1' },
      { fetchPolicy: 'network-only' },
    );
  });

  it('leaves out a manager or a state this build does not know', async () => {
    const known = {
      type: 'BREW',
      state: 'PRESENT',
      managed: true,
      installing: false,
      version: '5.1.3',
      versionChangedAt: null,
    };
    answers(
      Promise.resolve({
        device: {
          packageManagerDetails: [known, { ...known, type: 'SCOOP' }, { ...known, type: 'WINGET', state: 'BLOCKED' }],
        },
      }),
    );

    await expect(fetchDevicePackageManagers('machine-1')).resolves.toEqual([known]);
  });

  it('reads a refused query (a backend without the field) as null', async () => {
    answers(Promise.reject(new Error(MISSING_FIELD)));

    await expect(fetchDevicePackageManagers('machine-1')).resolves.toBeNull();
  });

  it('throws a transient failure, so the caller keeps its last answer', async () => {
    answers(Promise.reject(new Error('Relay fetch timed out after 30000ms: devicePackageManagersQuery')));

    await expect(fetchDevicePackageManagers('machine-1')).rejects.toThrow('timed out');
  });

  it('reads a missing device as no managers', async () => {
    answers(Promise.resolve({ device: null }));

    await expect(fetchDevicePackageManagers('machine-1')).resolves.toEqual([]);
  });
});

describe('isFieldMissingError', () => {
  it('knows the schema refusal and nothing else', () => {
    expect(isFieldMissingError(new Error(MISSING_FIELD))).toBe(true);
    expect(isFieldMissingError(new Error("Field 'packageManagerDetails' in type 'Machine' is undefined"))).toBe(true);
    // The tenant's GraphQL router (QA, 2026-11-26), as Relay carries it out of an answer with no data.
    expect(
      isFieldMissingError(
        new Error(
          'Relay: No data returned for operation `devicePackageManagersQuery`, got error(s):\nCannot query field "packageManagerDetails" on type "Machine".',
        ),
      ),
    ).toBe(true);
    expect(isFieldMissingError(new Error('Relay fetch failed: 502 Bad Gateway'))).toBe(false);
  });
});
