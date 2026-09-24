'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import {
  CheckboxBlock,
  ModalV2,
  ModalV2Content,
  ModalV2Footer,
  ModalV2Header,
  ModalV2Title,
  Skeleton,
  Switch,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useId, useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { notificationSettingsModalMutation as SettingsMutation } from '@/__generated__/notificationSettingsModalMutation.graphql';
import type { notificationSettingsModalQuery as SettingsQuery } from '@/__generated__/notificationSettingsModalQuery.graphql';

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

/** Matches `CheckboxBlock`'s description-less row and the master-switch row below. */
const ROW_SKELETON_CLASS = 'h-[44px] w-full shrink-0 md:h-[48px]';

/**
 * Placeholder row count — a height hint for the skeleton only, NOT a claim about how
 * many groups exist. The real list is the server's; a mismatch just resizes the panel
 * once when it lands.
 */
const SKELETON_ROWS = 8;

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
      <Suspense fallback={<NotificationSettingsSkeleton onClose={onClose} />}>
        <NotificationSettingsForm onClose={onClose} />
      </Suspense>
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

/**
 * The loading shape: real static copy, placeholder rows for everything that is a value.
 * The switch is NOT rendered unchecked-and-disabled — that reads as a real answer and
 * then flips once the settings arrive.
 */
function NotificationSettingsSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <>
      <ModalV2Content className={CONTENT_CLASS}>
        <Skeleton className={ROW_SKELETON_CLASS} />
        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <span className="uppercase text-ods-text-secondary text-h5">Notify about</span>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className={ROW_SKELETON_CLASS} />
          ))}
        </div>
      </ModalV2Content>
      <SettingsFooter onClose={onClose} />
    </>
  );
}

/**
 * Renders only once the settings are in hand (it is what suspends), which is why the
 * form state can be seeded straight from `data` with no effect.
 */
function NotificationSettingsForm({ onClose }: { onClose: () => void }) {
  const masterSwitchId = useId();
  const { toast } = useToast();
  const data = useLazyLoadQuery<SettingsQuery>(settingsQuery, {}, { fetchPolicy: 'network-only' });
  const [commit, isSaving] = useMutation<SettingsMutation>(updateSettingsMutation);

  const [enabled, setEnabled] = useState(data.notificationSettings.enabled);
  const [groups, setGroups] = useState(() =>
    data.notificationSettings.typeSettings.map(({ group, label, enabled: on }) => ({ group, label, enabled: on })),
  );

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
        <div className="flex min-h-[44px] items-center gap-[var(--spacing-system-s)] rounded-md bg-ods-card p-[var(--spacing-system-sf)] ring-1 ring-inset ring-ods-border md:min-h-[48px]">
          <Switch id={masterSwitchId} checked={enabled} onCheckedChange={setEnabled} disabled={isSaving} />
          <label htmlFor={masterSwitchId} className="cursor-pointer text-ods-text-primary text-h4">
            Enable Notifications
          </label>
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xs)]">
          <span className="uppercase text-ods-text-secondary text-h5">Notify about</span>
          {groups.map(({ group, label, enabled: on }) => (
            <CheckboxBlock
              key={group}
              id={`notification-group-${group}`}
              label={label}
              checked={on}
              // The master switch owns everything below it, so the per-group rows go
              // inert while it is off rather than implying they still have an effect.
              disabled={isSaving || !enabled}
              onCheckedChange={checked =>
                setGroups(prev => prev.map(row => (row.group === group ? { ...row, enabled: Boolean(checked) } : row)))
              }
            />
          ))}
        </div>
      </ModalV2Content>
      <SettingsFooter onClose={onClose} onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
