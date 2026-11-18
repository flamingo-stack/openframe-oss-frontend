import { describe, expect, it, vi } from 'vitest';
import type { insightCheckFields_insightCheck$key } from '@/__generated__/insightCheckFields_insightCheck.graphql';
import { sourceLabel } from '../components/checks/check-source';
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
    id: 'SW5zaWdodENoZWNrOjE=',
    check: 'resource-win-disk-low',
    title: 'Disk is almost full',
    platform: 'WINDOWS',
    description: 'Free space is below the threshold set for this device.',
    severity: 'HIGH',
    intervalSeconds: 3600,
    enabled: true,
    enabledScopeType: 'CUSTOMER',
    enabledScopeId: 'org-1',
    enabledScopeName: 'Acme',
    customized: true,
    parameters: [
      {
        parameter: 'freePercent',
        label: 'Free disk space',
        unit: 'PERCENT',
        firesWhen: 'BELOW',
        value: 15,
        defaultValue: 10,
        min: 1,
        max: 50,
        scopeType: 'TAG',
        scopeId: 'VGFnOnQtMQ==',
        scopeName: 'servers',
      },
    ],
    ...overrides,
  } as unknown as insightCheckFields_insightCheck$key);
}

describe('toIncidentCheck', () => {
  it('takes the name, severity, interval and every label from the API', () => {
    const check = diskLow();
    expect(check).toMatchObject({
      name: 'Disk is almost full',
      severity: 'HIGH',
      intervalSeconds: 3600,
      enabledSource: { type: 'CUSTOMER', id: 'org-1', name: 'Acme' },
    });
    expect(check.parameters[0]).toMatchObject({
      label: 'Free disk space',
      firesWhen: 'BELOW',
      unit: 'PERCENT',
      source: { type: 'TAG', id: 'VGFnOnQtMQ==', name: 'servers' },
    });
  });
});

describe('sourceLabel', () => {
  it('names an inherited customer, tag or device; says nothing more for one set here', () => {
    const check = diskLow();
    const [freePercent] = check.parameters;
    expect(freePercent && sourceLabel(freePercent.source, DEVICE)).toBe('From tag · servers');
    expect(sourceLabel(check.enabledSource, DEVICE)).toBe('From customer · Acme');
    expect(sourceLabel(check.enabledSource, CUSTOMER)).toBe('Set here');
    expect(sourceLabel({ type: 'CUSTOMER', id: 'org-1', name: null }, DEVICE)).toBe('From customer');
  });
});

describe('isSetHere', () => {
  it('matches the scope by kind and id; all devices by kind alone', () => {
    expect(isSetHere({ type: 'CUSTOMER', id: 'org-1', name: null }, CUSTOMER)).toBe(true);
    expect(isSetHere({ type: 'CUSTOMER', id: 'org-2', name: null }, CUSTOMER)).toBe(false);
    expect(isSetHere({ type: 'GLOBAL', id: null, name: null }, GLOBAL_SCOPE)).toBe(true);
    expect(isSetHere({ type: 'DEFAULT', id: null, name: null }, GLOBAL_SCOPE)).toBe(false);
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
          label: 'Free disk space',
          unit: 'PERCENT',
          firesWhen: 'BELOW',
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
