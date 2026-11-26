import { describe, expect, it, vi } from 'vitest';
import type { checkTransform_insightCheck$key } from '@/__generated__/checkTransform_insightCheck.graphql';
import type { checkTransform_override$key } from '@/__generated__/checkTransform_override.graphql';
import { formatDefaultThreshold, formatOverrideThreshold } from './check-labels';
import {
  GLOBAL_SCOPE,
  isEmptyDraft,
  overrideScope,
  overridesKeepingItOn,
  scopeInput,
  storedDefaultDraft,
  toCheck,
  toCheckOverride,
  toUpdateInput,
} from './check-transform';

// No Relay transform in vitest (the mock is hoisted above the imports): the fragment is a plain object and
// `readInlineData` hands the ref back.
vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: (_fragment: unknown, ref: unknown) => ref }));

/** `resource-battery` at GLOBAL: off for every device, health changed to 70%, cycles left at the built-in 1000. */
function battery(fields: Record<string, unknown> = {}) {
  return toCheck({
    id: 'SW5zaWdodENoZWNrOjE=',
    check: 'resource-battery',
    title: 'Battery is worn out',
    platform: 'MACOS',
    description: 'The battery holds too little charge.',
    severity: 'LOW',
    type: 'IT',
    intervalSeconds: 3600,
    enabled: false,
    enabledScopeType: 'GLOBAL',
    overrideCount: 2,
    parameters: [
      {
        parameter: 'minHealthPercent',
        label: 'Battery health',
        unit: 'PERCENT',
        firesWhen: 'BELOW',
        value: 70,
        defaultValue: 80,
        min: 1,
        max: 100,
        scopeType: 'GLOBAL',
      },
      {
        parameter: 'maxCycles',
        label: 'Charge cycles',
        unit: 'COUNT',
        firesWhen: 'ABOVE',
        value: 1000,
        defaultValue: 1000,
        min: 1,
        max: 5000,
        scopeType: 'DEFAULT',
      },
    ],
    ...fields,
  } as unknown as checkTransform_insightCheck$key);
}

function override(fields: Record<string, unknown> = {}) {
  return toCheckOverride({
    id: 'SW5zaWdodENoZWNrT3ZlcnJpZGU6MQ==',
    scopeType: 'TAG',
    scopeId: 'VGFnOnQtMQ==',
    scopeName: 'kiosk',
    enabled: null,
    parameters: [{ parameter: 'maxCycles', value: 900 }],
    deviceCount: 3,
    updatedAt: '2026-11-19T10:00:00Z',
    updatedBy: { firstName: 'Rin', lastName: 'Sowande', email: 'rin@example.com' },
    ...fields,
  } as unknown as checkTransform_override$key);
}

describe('toCheck', () => {
  it('reads the check as it runs at GLOBAL', () => {
    const check = battery();
    expect(check).toMatchObject({
      check: 'resource-battery',
      name: 'Battery is worn out',
      type: 'IT',
      enabled: false,
      enabledSetForAllDevices: true,
      overrideCount: 2,
    });
    expect(check.parameters.map(parameter => parameter.setForAllDevices)).toEqual([true, false]);
  });

  it('describes the default threshold as one phrase, and an on/off check as such', () => {
    expect(formatDefaultThreshold(battery())).toBe('Below 70% or above 1000');
    expect(formatDefaultThreshold(battery({ parameters: [] }))).toBe('On / off');
  });
});

describe('storedDefaultDraft', () => {
  it('keeps only what GLOBAL stores: the switch and the changed threshold', () => {
    expect(storedDefaultDraft(battery())).toEqual({ enabled: false, parameters: { minHealthPercent: 70 } });
  });

  it('stores no switch when it was never set for all devices', () => {
    expect(storedDefaultDraft(battery({ enabledScopeType: 'DEFAULT', enabled: true })).enabled).toBeNull();
  });
});

describe('toCheckOverride', () => {
  it('keeps only the stored values and names the last editor', () => {
    expect(override()).toMatchObject({
      scopeType: 'TAG',
      name: 'kiosk',
      enabled: null,
      parameters: { maxCycles: 900 },
      deviceCount: 3,
      updatedBy: 'Rin Sowande',
    });
  });

  it('falls back to the email, then to nobody', () => {
    expect(override({ updatedBy: { firstName: null, lastName: null, email: 'a@b.c' } }).updatedBy).toBe('a@b.c');
    expect(override({ updatedBy: null }).updatedBy).toBeNull();
  });

  it('is written at its own scope; an unknown scope type is not writable', () => {
    expect(overrideScope(override())).toEqual({ type: 'TAG', id: 'VGFnOnQtMQ==' });
    expect(overrideScope(override({ scopeType: 'SITE' }))).toBeNull();
  });
});

describe('formatOverrideThreshold', () => {
  it('shows only what the override stores', () => {
    expect(formatOverrideThreshold(battery(), override())).toBe('Above 900');
  });

  it('is Turned off when the exception turns the check off', () => {
    expect(formatOverrideThreshold(battery(), override({ enabled: false }))).toBe('Turned off');
  });

  it('is On when the override only turns the check on', () => {
    expect(formatOverrideThreshold(battery(), override({ enabled: true, parameters: [] }))).toBe('On');
  });
});

describe('overridesKeepingItOn', () => {
  it('lists the overrides that turn the check on', () => {
    const on = override({ enabled: true, scopeName: 'server' });
    expect(overridesKeepingItOn([override(), on]).map(item => item.name)).toEqual(['server']);
  });
});

describe('writes', () => {
  it('sends no scopeId for GLOBAL', () => {
    expect(scopeInput(GLOBAL_SCOPE)).toEqual({ scopeType: 'GLOBAL' });
    expect(scopeInput({ type: 'DEVICE', id: 'm-1' })).toEqual({ scopeType: 'DEVICE', scopeId: 'm-1' });
  });

  it('sends the whole draft, since an update replaces what the scope stores', () => {
    expect(toUpdateInput('resource-battery', GLOBAL_SCOPE, { enabled: null, parameters: { maxCycles: 900 } })).toEqual({
      check: 'resource-battery',
      scopeType: 'GLOBAL',
      enabled: null,
      parameters: [{ parameter: 'maxCycles', value: 900 }],
    });
  });

  it('knows a draft that stores nothing', () => {
    expect(isEmptyDraft({ enabled: null, parameters: {} })).toBe(true);
    expect(isEmptyDraft({ enabled: false, parameters: {} })).toBe(false);
  });
});
