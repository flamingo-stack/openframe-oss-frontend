import type {
  SoftwareUpdatePolicy,
  SoftwareUpdateSettingsValues,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { PackageUpdateMode } from '@/generated/schema-enums';

/** `PackageUpdateSettingsInput` as the submit takes it. */
export interface PackageUpdateSettingsInput {
  mode: PackageUpdateMode;
  /** Null: no deadline, the update waits for the user. Ignored by the server for FORCE. */
  deadlineSeconds: number | null;
  countdownSeconds: number;
}

/** `SoftwareAutoUpdateInput` as the submit takes it. */
export interface SoftwareAutoUpdateInput {
  enabled: boolean;
  /** Null: the update's own settings ("Same settings for auto-update"). */
  settings: PackageUpdateSettingsInput | null;
}

/** One policy as `PackageUpdateSettingsInput`: the update's, or a title's auto-update (`turnOnSoftwareAutoUpdate`). */
export function toPolicyInput(policy: SoftwareUpdatePolicy): PackageUpdateSettingsInput {
  const waits = policy.mode === 'WAIT';
  return {
    mode: waits ? PackageUpdateMode.WAIT : PackageUpdateMode.FORCE,
    // Force has no deadline; "Countdown after the deadline" off is a wait without one.
    deadlineSeconds: waits && policy.deadlineEnabled ? policy.deadlineSeconds : null,
    countdownSeconds: policy.countdownSeconds,
  };
}

/** The form's "Update Settings" as the submit's `updateSettings` + `autoUpdate`. */
export function toUpdateSettingsInputs(settings: SoftwareUpdateSettingsValues): {
  updateSettings: PackageUpdateSettingsInput;
  autoUpdate: SoftwareAutoUpdateInput;
} {
  return {
    updateSettings: toPolicyInput(settings.policy),
    autoUpdate: {
      enabled: settings.autoUpdate,
      settings: settings.autoUpdate && !settings.sameForAutoUpdate ? toPolicyInput(settings.autoUpdatePolicy) : null,
    },
  };
}

/** A saved `PackageUpdateSettings` as the fields draw it; `fallback` fills a deadline the policy does not have. */
export function fromPolicySettings(
  settings: { readonly mode: string; readonly deadlineSeconds?: number | null; readonly countdownSeconds: number },
  fallback: SoftwareUpdatePolicy,
): SoftwareUpdatePolicy {
  const waits = settings.mode === PackageUpdateMode.WAIT;
  return {
    mode: waits ? 'WAIT' : 'FORCE',
    deadlineEnabled: waits && settings.deadlineSeconds != null,
    deadlineSeconds: settings.deadlineSeconds ?? fallback.deadlineSeconds,
    countdownSeconds: settings.countdownSeconds,
  };
}
