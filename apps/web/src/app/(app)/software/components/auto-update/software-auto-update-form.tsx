'use client';

import {
  DEVICE_STATUS,
  type DeviceFilterInput,
  defaultSoftwareUpdateSettings,
  PACKAGE_MANAGER_OS,
  type SoftwareUpdatePolicy,
  SoftwareUpdatePolicyFields,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  CheckboxBlock,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { softwareAutoUpdateForm_policy$key } from '@/__generated__/softwareAutoUpdateForm_policy.graphql';
import type { softwareAutoUpdateFormTurnOffMutation as TurnOffMutationType } from '@/__generated__/softwareAutoUpdateFormTurnOffMutation.graphql';
import type { softwareAutoUpdateFormTurnOnMutation as TurnOnMutationType } from '@/__generated__/softwareAutoUpdateFormTurnOnMutation.graphql';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { BundleDevicePicker } from '../action-form/bundle-device-picker';
import { fromPolicySettings, toPolicyInput } from '../action-form/update-settings-input';
import { useDraftBundle } from '../action-form/use-draft-bundle';
import { useSeededBundle } from './use-seeded-bundle';

/**
 * On for the bundle's devices, off for the title's other devices; runs no update. Returns the title, so its page's
 * banner and AUTO-UPDATE cells read the new state from the store.
 */
const turnOnMutation = graphql`
  mutation softwareAutoUpdateFormTurnOnMutation($input: TurnOnSoftwareAutoUpdateInput!) {
    turnOnSoftwareAutoUpdate(input: $input) {
      id
      autoUpdate
    }
  }
`;

const turnOffMutation = graphql`
  mutation softwareAutoUpdateFormTurnOffMutation($softwareId: ID!) {
    turnOffSoftwareAutoUpdate(softwareId: $softwareId) {
      id
      autoUpdate
    }
  }
`;

/** The saved policy the form opens on: its settings, its devices, and whether it is on at all. */
const softwareAutoUpdateFormPolicyFragment = graphql`
  fragment softwareAutoUpdateForm_policy on SoftwareAutoUpdatePolicy {
    enabled
    machineIds
    settings {
      mode
      deadlineSeconds
      countdownSeconds
    }
  }
`;

/** The title and its saved policy, as the page read them. */
export interface SoftwareAutoUpdateTitle {
  name: string;
  policy: softwareAutoUpdateForm_policy$key;
}

/** Every system a package manager runs on: the picker's frame for a title of no one system. */
const PACKAGE_MANAGER_SYSTEMS = [...new Set(Object.values(PACKAGE_MANAGER_OS))];

const ENABLE_DESCRIPTION = 'Installs new versions automatically on selected devices. When off, it’s a one-time update.';

function agentMissing(device: { machineId?: string | null }): string | undefined {
  return device.machineId ? undefined : 'Agent is not\nconnected';
}

interface SoftwareAutoUpdateFormProps {
  softwareId: string;
  /** Null while it loads: the controls are drawn locked, nothing fetches and nothing saves. */
  title: SoftwareAutoUpdateTitle | null;
  /** The title's system; null for a kind several systems have, or while it loads. */
  os: string | null;
  loading?: boolean;
}

/**
 * The Auto-update settings form (design 1569:1890). The devices live on a draft bundle, as on Update Software, opened
 * with the page and seeded with the devices the policy is on; Save turns it on for exactly that bundle's devices
 * (`turnOnSoftwareAutoUpdate`), or off everywhere when "Enable Auto-Update" is unticked.
 */
export function SoftwareAutoUpdateForm({ softwareId, title, os, loading = false }: SoftwareAutoUpdateFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const detailsRoute = routes.software.details(softwareId);
  const handleBack = useSafeBack(detailsRoute);
  // Picks only what the settings open on: the server's 7-day deadline where devices can notify, Force otherwise.
  const notificationsGate = useFeatureFlagGate('software-update-notifications');
  const userNotifications = notificationsGate === 'on';

  const saved = useFragment(softwareAutoUpdateFormPolicyFragment, title?.policy ?? null);
  // The page is where auto-update is turned on: it opens ticked, as the design does, and on the saved settings.
  const [enabled, setEnabled] = useState(true);
  const savedPolicy = (): SoftwareUpdatePolicy => {
    const fallback = defaultSoftwareUpdateSettings(userNotifications).policy;
    const settings = saved?.settings;
    if (!settings) return fallback;
    const { mode, deadlineSeconds, countdownSeconds } = settings;
    return fromPolicySettings({ mode, deadlineSeconds, countdownSeconds }, fallback);
  };
  const [policy, setPolicy] = useState<SoftwareUpdatePolicy>(savedPolicy);
  // The page draws the policy the store holds first and the server's answer after it (store-and-network): back from a
  // Save, the store's is the one from before it. Until the user edits a field, the form follows the saved settings as
  // they land; otherwise a Save made for another field wrote the stale deadline and countdown back.
  const [edited, setEdited] = useState(false);
  const settingsKey = saved?.settings
    ? `${saved.settings.mode}:${saved.settings.deadlineSeconds}:${saved.settings.countdownSeconds}`
    : '';
  const [seededKey, setSeededKey] = useState(settingsKey);
  if (seededKey !== settingsKey) {
    setSeededKey(settingsKey);
    if (!edited) setPolicy(savedPolicy());
  }
  const editPolicy = (next: SoftwareUpdatePolicy) => {
    setEdited(true);
    setPolicy(next);
  };

  // The devices it can be on: live ones on the title's systems. One object per system, since the picker's queries and
  // facets are keyed by it.
  const scope = useMemo<DeviceFilterInput>(
    () => ({ statuses: [DEVICE_STATUS.MANAGED], osTypes: os ? [os] : PACKAGE_MANAGER_SYSTEMS }),
    [os],
  );
  const draft = useDraftBundle({ enabled: !loading });
  const seeded = useSeededBundle(draft.bundleId, saved?.machineIds ?? []);
  const [commitTurnOn, isTurningOn] = useMutation<TurnOnMutationType>(turnOnMutation);
  const [commitTurnOff, isTurningOff] = useMutation<TurnOffMutationType>(turnOffMutation);
  const saving = isTurningOn || isTurningOff;

  const fail = (description: string) => {
    toast({ title: 'Error', description, variant: 'destructive' });
  };

  const leave = (message: string) => {
    toast({ title: 'Auto-update saved', description: message, variant: 'success' });
    router.push(detailsRoute);
  };

  const save = () => {
    if (!title) return;
    if (!enabled) {
      // Off already: nothing to save.
      if (!saved?.enabled) {
        router.push(detailsRoute);
        return;
      }
      commitTurnOff({
        variables: { softwareId },
        onCompleted: () => leave(`${title.name} updates only when you run Update Software.`),
        onError: error => fail(getRelayErrorMessage(error, 'Failed to turn off auto-update')),
      });
      return;
    }
    if (!draft.bundleId || draft.deviceCount === 0) {
      fail('Select at least one device to keep updated.');
      return;
    }
    commitTurnOn({
      variables: { input: { softwareId, bundleId: draft.bundleId, settings: toPolicyInput(policy) } },
      onCompleted: () => {
        // The bundle is COMPLETED now: the policy's record, not a draft to discard.
        draft.markSubmitted();
        leave(`New versions of ${title.name} are installed automatically on the selected devices.`);
      },
      onError: error => fail(getRelayErrorMessage(error, 'Failed to turn on auto-update')),
    });
  };

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    {
      label: 'Save',
      variant: 'accent',
      onClick: save,
      disabled: loading || !title || seeded === 'seeding' || notificationsGate === 'loading',
      loading: saving,
    },
  ];

  return (
    <PageLayout
      title={title ? `${title.name} Auto-update` : 'Auto-update'}
      loading={!title}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <CheckboxBlock
        id="software-auto-update-enabled"
        checked={enabled}
        onCheckedChange={setEnabled}
        disabled={!title}
        label="Enable Auto-Update"
        description={ENABLE_DESCRIPTION}
      />

      {enabled && (
        <>
          <SoftwareUpdatePolicyFields name="autoUpdatePolicy" policy={policy} onChange={editPolicy} />

          <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">Device Selection</h2>

          <BundleDevicePicker
            // The picker's lists are the bundle's: they open once the policy's devices are on it.
            bundleId={seeded === 'seeded' ? draft.bundleId : null}
            createError={draft.createError}
            onRetryCreate={draft.retryCreate}
            scope={scope}
            isDeviceDisabled={agentMissing}
          />
        </>
      )}
    </PageLayout>
  );
}
