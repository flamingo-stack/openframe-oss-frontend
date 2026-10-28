import {
  DEFAULT_SOFTWARE_UPDATE_POLICY,
  DEFAULT_SOFTWARE_UPDATE_SETTINGS,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { describe, expect, it } from 'vitest';
import { toUpdateSettingsInputs } from './update-settings-input';

const DAY = 86_400;

describe('toUpdateSettingsInputs', () => {
  it('sends the defaults as the server spells them, auto-update on its own settings', () => {
    expect(toUpdateSettingsInputs(DEFAULT_SOFTWARE_UPDATE_SETTINGS)).toEqual({
      updateSettings: { mode: 'WAIT', deadlineSeconds: 7 * DAY, countdownSeconds: 300 },
      autoUpdate: { enabled: true, settings: null },
    });
  });

  it('a wait without "Countdown after the deadline" has no deadline', () => {
    const { updateSettings } = toUpdateSettingsInputs({
      ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
      policy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, deadlineEnabled: false },
    });
    expect(updateSettings.deadlineSeconds).toBeNull();
  });

  it('force never carries a deadline, even with one still set underneath', () => {
    const { updateSettings } = toUpdateSettingsInputs({
      ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
      policy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', countdownSeconds: 60 },
    });
    expect(updateSettings).toEqual({ mode: 'FORCE', deadlineSeconds: null, countdownSeconds: 60 });
  });

  it('separate auto-update settings are sent; off, they are not', () => {
    const separate = {
      ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
      sameForAutoUpdate: false,
      autoUpdatePolicy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE' as const, countdownSeconds: 900 },
    };
    expect(toUpdateSettingsInputs(separate).autoUpdate).toEqual({
      enabled: true,
      settings: { mode: 'FORCE', deadlineSeconds: null, countdownSeconds: 900 },
    });
    expect(toUpdateSettingsInputs({ ...separate, autoUpdate: false }).autoUpdate).toEqual({
      enabled: false,
      settings: null,
    });
  });
});
