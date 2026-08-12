'use client';

import { Button, Skeleton, Switch } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useId, useState } from 'react';
import { fetchQuery, useMutation, useRelayEnvironment } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type { notificationSettingsRelayQuery as NotificationSettingsRelayQueryType } from '@/__generated__/notificationSettingsRelayQuery.graphql';
import type { updateNotificationContentSuppressionMutation as UpdateContentSuppressionMutationType } from '@/__generated__/updateNotificationContentSuppressionMutation.graphql';
import type { updateNotificationSettingsMutation as UpdateNotificationSettingsMutationType } from '@/__generated__/updateNotificationSettingsMutation.graphql';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { notificationSettingsRelayQuery } from '@/graphql/notifications/notification-settings-relay';
import { updateNotificationContentSuppressionMutation } from '@/graphql/notifications/update-notification-content-suppression-mutation';
import { updateNotificationSettingsMutation } from '@/graphql/notifications/update-notification-settings-mutation';
import { getErrorMessage } from '@/lib/handle-api-error';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Roles are plain gateway strings with no schema enum; compare case-insensitively
// (same convention as use-owner-gate / employee-details-view).
const SUPPRESSION_MANAGER_ROLES = new Set(['admin', 'owner']);

/** NotificationSettings has no id, so mutation payloads don't auto-merge into the query root. */
const relinkNotificationSettings = (rootField: string) => (store: RecordSourceSelectorProxy) => {
  const payload = store.getRootField(rootField);
  if (payload) store.getRoot().setLinkedRecord(payload, 'notificationSettings');
};

export function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const { toast } = useToast();
  const pushSwitchId = useId();
  const suppressionSwitchId = useId();
  const environment = useRelayEnvironment();
  const { user } = useAuthSession();

  const canManageSuppression = (user?.roles ?? []).some(role =>
    SUPPRESSION_MANAGER_ROLES.has(role?.toLowerCase() ?? ''),
  );

  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [contentSuppressed, setContentSuppressed] = useState<boolean | null>(null);
  const [savedContentSuppressed, setSavedContentSuppressed] = useState<boolean | null>(null);

  const [commitSettings, isSavingSettings] = useMutation<UpdateNotificationSettingsMutationType>(
    updateNotificationSettingsMutation,
  );
  const [commitSuppression, isSavingSuppression] = useMutation<UpdateContentSuppressionMutationType>(
    updateNotificationContentSuppressionMutation,
  );
  const isSaving = isSavingSettings || isSavingSuppression;

  useEffect(() => {
    if (!isOpen) {
      setPushEnabled(null);
      setContentSuppressed(null);
      setSavedContentSuppressed(null);
      return;
    }

    const subscription = fetchQuery<NotificationSettingsRelayQueryType>(
      environment,
      notificationSettingsRelayQuery,
      {},
      { fetchPolicy: 'store-or-network' },
    ).subscribe({
      next: data => {
        setPushEnabled(data.notificationSettings.pushEnabled);
        setContentSuppressed(data.notificationSettings.contentSuppressed);
        setSavedContentSuppressed(data.notificationSettings.contentSuppressed);
      },
      error: (error: unknown) => {
        toast({
          title: 'Error',
          description: getErrorMessage(error) || 'Failed to load notification settings',
          variant: 'destructive',
        });
      },
    });
    return () => subscription.unsubscribe();
  }, [isOpen, environment, toast]);

  const isLoading = pushEnabled === null;

  const handleSave = () => {
    if (pushEnabled === null) return;

    const commits: Promise<void>[] = [
      new Promise((resolve, reject) => {
        commitSettings({
          variables: { pushEnabled },
          updater: relinkNotificationSettings('updateNotificationSettings'),
          onCompleted: () => resolve(),
          onError: reject,
        });
      }),
    ];

    // The tenant-wide switch is a separate, admin-only mutation — commit it only
    // when the value actually changed so non-privileged saves never touch it.
    if (canManageSuppression && contentSuppressed !== null && contentSuppressed !== savedContentSuppressed) {
      commits.push(
        new Promise((resolve, reject) => {
          commitSuppression({
            variables: { suppressed: contentSuppressed },
            updater: relinkNotificationSettings('updateNotificationContentSuppression'),
            onCompleted: () => resolve(),
            onError: reject,
          });
        }),
      );
    }

    Promise.all(commits)
      .then(() => {
        toast({
          title: 'Notifications Updated',
          description: 'Your notification settings have been saved.',
          variant: 'success',
        });
        onClose();
      })
      .catch((error: unknown) => {
        toast({
          title: 'Error',
          description: getErrorMessage(error) || 'Failed to update notification settings',
          variant: 'destructive',
        });
      });
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      className="max-w-[600px]"
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
            disabled={isLoading || isSaving}
            className="flex-1 h-12 bg-ods-accent text-ods-text-on-accent text-h3 hover:bg-ods-accent/90"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-md" />
      ) : (
        <div className="flex flex-col gap-[var(--spacing-system-s)]">
          <div className="bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-sf)] flex items-center gap-[var(--spacing-system-s)]">
            <Switch id={pushSwitchId} checked={pushEnabled} onCheckedChange={setPushEnabled} disabled={isSaving} />
            <label htmlFor={pushSwitchId} className="flex-1 min-w-0 truncate text-h4 text-ods-text-primary">
              Enable Notifications
            </label>
          </div>
          {canManageSuppression && contentSuppressed !== null && (
            <div className="bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-sf)] flex items-center gap-[var(--spacing-system-s)]">
              <Switch
                id={suppressionSwitchId}
                checked={contentSuppressed}
                onCheckedChange={setContentSuppressed}
                disabled={isSaving}
              />
              <div className="flex-1 min-w-0 flex flex-col">
                <label htmlFor={suppressionSwitchId} className="truncate text-h4 text-ods-text-primary">
                  Hide Message Content
                </label>
                <span className="text-h6 text-ods-text-secondary">
                  Tenant-wide privacy mode: notifications show a neutral line instead of message content for everyone.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </SimpleModal>
  );
}
