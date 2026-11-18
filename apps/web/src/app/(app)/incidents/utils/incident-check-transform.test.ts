import { describe, expect, it, vi } from 'vitest';
import type { insightCheckFields_insightCheck$key } from '@/__generated__/insightCheckFields_insightCheck.graphql';
import {
  GLOBAL_SCOPE,
  isEmptyDraft,
  isSetHere,
  scopeInput,
  storedDraft,
  toIncidentCheck,
  toUpdateInput,
  withEnabled,
} from './incident-check-transform';

// No Relay transform in vitest (the mock is hoisted above the imports): the fragment is a plain object and
// `readInlineData` hands the ref back.
vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const CUSTOMER = { type: 'CUSTOMER', id: 'org-1' } as const;
const DEVICE = { type: 'DEVICE', id: 'm-1' } as const;

/** `resource-win-disk-low` as the API answers it for a device: on from the customer, 15% from a tag. */
function diskLow(overrides: Record<string, unknown> = {}) {
  return toIncidentCheck({
    check: 'resource-win-disk-low',
    kind: 'DISK_SPACE_LOW',
    platform: 'WINDOWS',
    description: 'Free space is below the threshold set for this device.',
    enabled: true,
    enabledScopeType: 'CUSTOMER',
    enabledScopeId: 'org-1',
    customized: true,
    parameters: [
      {
        parameter: 'freePercent',
        unit: 'PERCENT',
        value: 15,
        defaultValue: 10,
        min: 1,
        max: 50,
        scopeType: 'TAG',
        scopeId: 'VGFnOnQtMQ==',
      },
    ],
    ...overrides,
  } as unknown as insightCheckFields_insightCheck$key);
}

describe('toIncidentCheck', () => {
  it('names the check by its kind and the parameter by its key', () => {
    const check = diskLow();
    expect(check.name).toBe('Low disk space');
    expect(check.parameters[0]).toMatchObject({
      label: 'Free disk space',
      comparison: 'below',
      unit: 'PERCENT',
      source: { type: 'TAG', id: 'VGFnOnQtMQ==' },
    });
  });

  it('shows an unknown parameter by its key, with no side', () => {
    const check = diskLow({
      parameters: [
        { parameter: 'maxWidgets', unit: 'COUNT', value: 3, defaultValue: 3, min: 1, max: 9, scopeType: 'DEFAULT' },
      ],
    });
    expect(check.parameters[0]).toMatchObject({ label: 'maxWidgets', comparison: null });
  });
});

describe('isSetHere', () => {
  it('matches the scope by kind and id; all devices by kind alone', () => {
    expect(isSetHere({ type: 'CUSTOMER', id: 'org-1' }, CUSTOMER)).toBe(true);
    expect(isSetHere({ type: 'CUSTOMER', id: 'org-2' }, CUSTOMER)).toBe(false);
    expect(isSetHere({ type: 'GLOBAL', id: null }, GLOBAL_SCOPE)).toBe(true);
    expect(isSetHere({ type: 'DEFAULT', id: null }, GLOBAL_SCOPE)).toBe(false);
  });
});

describe('storedDraft', () => {
  it('keeps only what the shown scope sets', () => {
    expect(storedDraft(diskLow(), CUSTOMER)).toEqual({ enabled: true, parameters: {} });
    expect(storedDraft(diskLow(), DEVICE)).toEqual({ enabled: null, parameters: {} });
  });
});

describe('withEnabled', () => {
  it('sets the switch and keeps every threshold the scope stores', () => {
    const check = diskLow({
      enabledScopeType: 'DEFAULT',
      enabledScopeId: null,
      parameters: [
        {
          parameter: 'freePercent',
          unit: 'PERCENT',
          value: 20,
          defaultValue: 10,
          min: 1,
          max: 50,
          scopeType: 'DEVICE',
          scopeId: 'm-1',
        },
      ],
    });
    expect(withEnabled(check, DEVICE, false)).toEqual({ enabled: false, parameters: { freePercent: 20 } });
  });
});

describe('the write', () => {
  it('sends no scopeId for all devices', () => {
    expect(scopeInput(GLOBAL_SCOPE)).toEqual({ scopeType: 'GLOBAL' });
    expect(scopeInput(CUSTOMER)).toEqual({ scopeType: 'CUSTOMER', scopeId: 'org-1' });
  });

  it('replaces the whole stored setting: enabled null inherits, a parameter left out inherits', () => {
    expect(toUpdateInput('resource-uptime', DEVICE, { enabled: null, parameters: { maxDays: 7 } })).toEqual({
      check: 'resource-uptime',
      scopeType: 'DEVICE',
      scopeId: 'm-1',
      enabled: null,
      parameters: [{ parameter: 'maxDays', value: 7 }],
    });
  });

  it('treats a draft with nothing set as a reset', () => {
    expect(isEmptyDraft({ enabled: null, parameters: {} })).toBe(true);
    expect(isEmptyDraft({ enabled: false, parameters: {} })).toBe(false);
    expect(isEmptyDraft({ enabled: null, parameters: { maxDays: 7 } })).toBe(false);
  });
});
