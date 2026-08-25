'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { CheckboxBlock, Switch } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useId, useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { notificationSettingsModalMutation as SettingsMutation } from '@/__generated__/notificationSettingsModalMutation.graphql';
import type { notificationSettingsModalQuery as SettingsQuery } from '@/__generated__/notificationSettingsModalQuery.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { NotificationSettingGroup } from '@/generated/schema-enums';

const settingsQuery = graphql`
  query notificationSettingsModalQuery {
    notificationSettings {
      enabled
      typeSettings {
        group
        enabled
      }
    }
  }
`;

const updateSettingsMutation = graphql`
  mutation notificationSettingsModalMutation($enabled: Boolean!, $typeSettings: [NotificationTypeSettingInput!]) {
    updateNotificationSettings(enabled: $enabled, typeSettings: $typeSettings) {
      enabled
      typeSettings {
        group
        enabled
      }
    }
  }
`;

/** Schema order — the design lists the groups in exactly this sequence. */
const GROUPS = Object.values(NotificationSettingGroup);

const GROUP_LABELS: Record<NotificationSettingGroup, string> = {
  TICKET_ASSIGNED: 'Ticket assigned',
  TICKET_STATUS_CHANGED: 'Ticket status changed',
  CUSTOMER_REPLIED: 'Customer replied',
  ADMIN_REPLIED: 'Admin replied',
  MINGO_MESSAGES: 'New messages from mingo',
  APPROVAL_TICKET: 'Approval required ticket',
  APPROVAL_MINGO: 'Approval required mingo',
};

interface NotificationSettingsModalProps {
  onClose: () => void;
}

/**
 * Per-user notification preferences: the master switch plus one checkbox per
 * `NotificationSettingGroup`.
 *
 * These are not cosmetic — the backend filters the audience by them BEFORE anything
 * is persisted or published (`NotificationBroadcaster.withoutOptedOut`), so an
 * opted-out group produces no in-app card, no NATS publish and no push, and nothing
 * arrives retroactively when it is switched back on.
 *
 * Mounted only while open (see the call site) because `useLazyLoadQuery` suspends:
 * the component renders once the settings are in hand, which is also why the form
 * state can be seeded straight from `data` with no effect.
 *
 * `network-only` on purpose. `NotificationSettings` carries no `id`, so Relay cannot
 * normalise the mutation's payload back onto the record this query read — reopening
 * on a cached store would show pre-save values. The payload is a handful of booleans,
 * so refetching per open is cheaper than a store updater.
 */
export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  const masterSwitchId = useId();
  const { toast } = useToast();
  const data = useLazyLoadQuery<SettingsQuery>(settingsQuery, {}, { fetchPolicy: 'network-only' });
  const [commit, isSaving] = useMutation<SettingsMutation>(updateSettingsMutation);

  const [enabled, setEnabled] = useState(data.notificationSettings.enabled);
  const [groups, setGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.notificationSettings.typeSettings.map(setting => [setting.group, setting.enabled])),
  );

  const handleSave = () => {
    commit({
      variables: { enabled, typeSettings: GROUPS.map(group => ({ group, enabled: Boolean(groups[group]) })) },
      onCompleted: () => {
        toast({ title: 'Saved', description: 'Notification settings updated.', variant: 'success' });
        onClose();
      },
      onError: error => {
        // Keep the modal open so the edit is not lost.
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      },
    });
  };

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      className="max-w-[520px]"
      title="Notifications"
      contentClassName="flex flex-col gap-[var(--spacing-system-m)]"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 h-12 bg-ods-card border-ods-border text-ods-text-primary text-h3 hover:bg-ods-bg"
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-12 bg-ods-accent text-ods-text-on-accent text-h3 hover:bg-ods-accent/90"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-[var(--spacing-system-s)] rounded-md ring-1 ring-inset ring-ods-border bg-ods-card p-[var(--spacing-system-sf)] min-h-[44px] md:min-h-[48px]">
        <Switch id={masterSwitchId} checked={enabled} onCheckedChange={setEnabled} disabled={isSaving} />
        <label htmlFor={masterSwitchId} className="text-h4 text-ods-text-primary cursor-pointer">
          Enable Notifications
        </label>
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <span className="text-h5 text-ods-text-secondary uppercase">Notify about</span>
        {GROUPS.map(group => (
          <CheckboxBlock
            key={group}
            id={`notification-group-${group}`}
            label={GROUP_LABELS[group]}
            checked={Boolean(groups[group])}
            // The master switch owns everything below it, so the per-group rows go
            // inert while it is off rather than implying they still have an effect.
            disabled={isSaving || !enabled}
            onCheckedChange={checked => setGroups(prev => ({ ...prev, [group]: Boolean(checked) }))}
          />
        ))}
      </div>
    </SimpleModal>
  );
}
