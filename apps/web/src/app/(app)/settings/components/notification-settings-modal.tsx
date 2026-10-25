'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  CheckboxBlock,
  LoadingItems,
  ModalV2,
  ModalV2Content,
  ModalV2Footer,
  ModalV2Header,
  ModalV2Title,
  Switch,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useId, useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { notificationSettingsModalMutation as SettingsMutation } from '@/__generated__/notificationSettingsModalMutation.graphql';
import type {
  notificationSettingsModalQuery as SettingsQuery,
  notificationSettingsModalQuery$data,
} from '@/__generated__/notificationSettingsModalQuery.graphql';

const settingsQuery = graphql`
  query notificationSettingsModalQuery {
    notificationSettings {
      enabled
      typeSettings {
        group
        label
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

const CONTENT_CLASS = 'flex flex-col gap-[var(--spacing-system-m)]';
const CANCEL_BUTTON_CLASS = 'h-12 flex-1 border-ods-border bg-ods-card text-ods-text-primary text-h3 hover:bg-ods-bg';
const SAVE_BUTTON_CLASS = 'h-12 flex-1 bg-ods-accent text-ods-text-on-accent text-h3 hover:bg-ods-accent/90';

/**
 * The master-switch row's frame, the same loading and loaded. No height of its own: the label is fixed copy, drawn
 * for real in both forms, so its line (taller than the 16px switch) and the padding set the row's height.
 */
const MASTER_ROW_CLASS =
  'flex items-center gap-[var(--spacing-system-s)] rounded-md bg-ods-card p-[var(--spacing-system-sf)] ring-1 ring-inset ring-ods-border';
/**
 * Group rows the loading list draws. The list is the server's and not paged, so there is no page size: this is a
 * typical count, NOT a claim about how many groups exist; a mismatch resizes the panel once when it lands.
 */
const NOTIFICATION_GROUPS_SKELETON_ROWS = 8;

type NotificationSettings = notificationSettingsModalQuery$data['notificationSettings'];

interface NotificationSettingsModalProps {
  onClose: () => void;
}

/**
 * Per-user notification preferences: the master switch plus one checkbox per group.
 *
 * The group list, its captions and its order are the server's — `typeSettings` returns
 * every group exactly once with defaults resolved and a ready-to-render `label`. Do not
 * re-derive the rows from the `NotificationSettingGroup` enum or map the enum to copy
 * here: the enum only moves when the SDL is refetched, so a group added or relabelled
 * backend-side would silently keep the old caption, or be missing from the save payload
 * entirely — and a group omitted from that payload keeps whatever value it already had.
 *
 * These are not cosmetic — the backend filters the audience by them BEFORE anything
 * is persisted or published (`NotificationBroadcaster.withoutOptedOut`), so an
 * opted-out group produces no in-app card, no NATS publish and no push, and nothing
 * arrives retroactively when it is switched back on.
 *
 * SPLIT DELIBERATELY: the panel chrome renders here, above the Suspense boundary, so the
 * modal opens on the click instead of after the round-trip — `useLazyLoadQuery` suspends,
 * and with the boundary at the call site nothing at all appeared until the settings
 * arrived. The boundary must stay INSIDE one `ModalV2`, because swapping a whole fallback
 * modal for a whole loaded one remounts the panel: `ModalV2` restores focus to the opener
 * on unmount and replays its 200ms enter animation on mount, so the modal would visibly
 * flash and bounce focus the moment the data landed. That in turn is why this uses the
 * `ModalV2*` primitives rather than `SimpleModal` — the boundary has to span both the
 * content and the footer slots, which `SimpleModal`'s single `footer` prop cannot express.
 *
 * `network-only` on purpose. `NotificationSettings` carries no `id`, so Relay cannot
 * normalise the mutation's payload back onto the record this query read — reopening
 * on a cached store would show pre-save values. The payload is a handful of booleans,
 * so refetching per open is cheaper than a store updater. It also means every open pays
 * the round-trip, hence the skeleton rather than a cache hit.
 */
export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  return (
    <ModalV2 isOpen onClose={onClose} className="max-w-[520px]">
      <ModalV2Header>
        <ModalV2Title>Notifications</ModalV2Title>
      </ModalV2Header>
      {/* A live wait (a bare scope, no element), so Cancel stays live while the settings load and the content and
          footer stay the panel's own flex children. */}
      <LoadingSuspense
        live
        label="Loading notification settings"
        fallback={<NotificationSettingsFormView settings={null} onClose={onClose} />}
      >
        <NotificationSettingsForm onClose={onClose} />
      </LoadingSuspense>
    </ModalV2>
  );
}

/**
 * Cancel + Save for both states. No `onSave` means the settings are still loading, so
 * there is nothing to submit — Cancel stays live, which is the escape hatch on a slow
 * connection.
 */
function SettingsFooter({
  onClose,
  onSave,
  isSaving = false,
}: {
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}) {
  return (
    <ModalV2Footer>
      <Button variant="outline" onClick={onClose} disabled={isSaving} className={CANCEL_BUTTON_CLASS}>
        Cancel
      </Button>
      <Button variant="accent" onClick={onSave} disabled={!onSave || isSaving} className={SAVE_BUTTON_CLASS}>
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </ModalV2Footer>
  );
}

/** The query (it is what suspends); the form is `NotificationSettingsFormView`. */
function NotificationSettingsForm({ onClose }: { onClose: () => void }) {
  const data = useLazyLoadQuery<SettingsQuery>(settingsQuery, {}, { fetchPolicy: 'network-only' });
  return <NotificationSettingsFormView settings={data.notificationSettings} onClose={onClose} />;
}

/**
 * The form over the settings; `settings` is `null` while they load (drawn in the Suspense fallback's scope). The
 * fallback and the loaded form are separate mounts, so the form state is seeded straight from `settings`, no effect.
 */
function NotificationSettingsFormView({
  settings,
  onClose,
}: {
  settings: NotificationSettings | null;
  onClose: () => void;
}) {
  const masterSwitchId = useId();
  const { toast } = useToast();
  const [commit, isSaving] = useMutation<SettingsMutation>(updateSettingsMutation);

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [groups, setGroups] = useState(() =>
    (settings?.typeSettings ?? []).map(({ group, label, enabled: on }) => ({ group, label, enabled: on })),
  );

  // While the settings load (the Suspense fallback's scope): the same form, its static copy real, the switch and each
  // group's box and label bars, Save inert (there is nothing to submit yet).
  const loading = useLoadingScope() || settings == null;

  const handleSave = () => {
    commit({
      variables: { enabled, typeSettings: groups.map(({ group, enabled: on }) => ({ group, enabled: on })) },
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
    <>
      <ModalV2Content className={CONTENT_CLASS}>
        <div className={MASTER_ROW_CLASS}>
          <Switch
            id={masterSwitchId}
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isSaving}
            loading={loading}
          />
          <label htmlFor={masterSwitchId} className="cursor-pointer text-ods-text-primary text-h4">
            Enable Notifications
          </label>
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <span className="uppercase text-ods-text-secondary text-h5">Notify about</span>
          {loading ? (
            <LoadingItems count={NOTIFICATION_GROUPS_SKELETON_ROWS}>
              {() => <CheckboxBlock data-loading-item label={null} loading />}
            </LoadingItems>
          ) : (
            groups.map(({ group, label, enabled: on }) => (
              <CheckboxBlock
                key={group}
                data-loading-item
                id={`notification-group-${group}`}
                label={label}
                checked={on}
                // The master switch owns everything below it, so the per-group rows go
                // inert while it is off rather than implying they still have an effect.
                disabled={isSaving || !enabled}
                onCheckedChange={checked =>
                  setGroups(prev =>
                    prev.map(row => (row.group === group ? { ...row, enabled: Boolean(checked) } : row)),
                  )
                }
              />
            ))
          )}
        </div>
      </ModalV2Content>
      <SettingsFooter onClose={onClose} onSave={loading ? undefined : handleSave} isSaving={isSaving} />
    </>
  );
}
