'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { useMutation } from 'react-relay';
import type { updateScriptScheduleMutation as UpdateScheduleMutationType } from '@/__generated__/updateScriptScheduleMutation.graphql';
import { ScheduleDeviceSelectionMode, ScriptScheduleTrigger } from '@/generated/schema-enums';
import { updateScriptScheduleMutation } from '@/graphql/scripts/update-script-schedule-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { platformsToEnums, platformsToIds } from '../../shared/utils/script-mappers';
import type { ScheduleDevicesSettingsData } from '../types/schedule-detail.types';
import { toEnvVarInputs } from '../utils/schedule-script-params';
import { isEventTrigger, resolveOfflineBehavior } from '../utils/schedule-timing';

interface SaveSpecificModeCallbacks {
  onSaved?: () => void;
  /** The write failed — the caller has to put its optimistic radio back. */
  onFailed?: () => void;
}

/**
 * Switching a schedule back to SPECIFIC targeting.
 *
 * **Committed the moment the radio is clicked**, not behind a Save button. The
 * mode is what the per-row `assigned` flag MEANS: on a CRITERIA schedule the
 * server answers it as "this device matches the rule", so a picker opened before
 * the switch lands pre-checks rows that are not in the explicit list at all —
 * and a click on one of them reads as "remove" when the user meant "add". There
 * is no honest way to draw the specific half of a schedule the server still
 * considers rule-driven, so the switch happens first and the list is drawn
 * against the answer it produced.
 *
 * That also matches how the specific half works everywhere else: every +/− is
 * committed as it happens, which is why the page exits through Done.
 *
 * The other direction stays behind an explicit Save: it needs the RULE, which
 * the user is still editing, and `setScheduleDeviceCriteria` carries both.
 *
 * The return trip has no mutation of its own — the schema puts `selectionMode`
 * on `UpdateScriptScheduleInput` instead, so it rides the schedule's full
 * update.
 *
 * That update is a **PUT**: every writable field on the input overwrites the
 * stored value, and an omitted one clears it. So this sends the schedule back
 * unchanged around the single field it means to change — name, description,
 * platforms, the script list in run order, the per-script overrides, the trigger,
 * the timing, and the offline behavior with its reconnect window. Dropping any of
 * them here would empty it. That is why the page this hook serves reads them (see
 * `script-schedule-devices-settings-relay.ts`) even though it renders none of
 * them.
 *
 * The rule itself is deliberately NOT cleared. Per the schema, flipping modes
 * "leaves the join rows/rule untouched" — so a schedule switched back to
 * SPECIFIC keeps its criteria on file, and switching to CRITERIA again restores
 * what was written rather than starting from an empty rule.
 */
export function useScheduleSelectionMode(schedule: ScheduleDevicesSettingsData | null | undefined) {
  const { toast } = useToast();
  const [commitUpdate, isSavingMode] = useMutation<UpdateScheduleMutationType>(updateScriptScheduleMutation);

  const saveSpecificMode = useCallback(
    ({ onSaved, onFailed }: SaveSpecificModeCallbacks = {}) => {
      if (!schedule) {
        onFailed?.();
        return;
      }

      commitUpdate({
        variables: {
          input: {
            id: schedule.id,
            name: schedule.name,
            description: schedule.description ?? null,
            // Normalized through the app's own mappers rather than passed
            // through: Relay types every schema enum with a `%future added
            // value` member, which the input does not accept. The round trip
            // drops anything this client doesn't know, which is also the only
            // value it could not send.
            supportedPlatforms: platformsToEnums(platformsToIds(schedule.supportedPlatforms)),
            scriptIds: schedule.scripts.map(s => s.id),
            scriptCustomParams: schedule.scriptCustomParams.map(entry => ({
              scriptId: entry.scriptId,
              // Null and empty differ here — null inherits the script's default,
              // `[]` means "run with none" — so the nullability is preserved
              // rather than normalized to an array.
              args: entry.args ? [...entry.args] : null,
              envVars: entry.envVars ? toEnvVarInputs(entry.envVars) : null,
            })),
            trigger: isEventTrigger(schedule.trigger)
              ? ScriptScheduleTrigger.DEVICE_ONLINE
              : ScriptScheduleTrigger.DATE_TIME,
            selectionMode: ScheduleDeviceSelectionMode.SPECIFIC,
            // Same round trip as the platforms above, and the one field where
            // dropping it would not just blank a value: the input reads null as
            // SKIP, so omitting it would quietly turn a schedule that queues
            // runs for offline devices into one that skips them.
            offlineBehavior: resolveOfflineBehavior(schedule.offlineBehavior),
            reconnectWindowSeconds: schedule.reconnectWindowSeconds,
            startAt: schedule.startAt,
            repeat: schedule.repeat,
          },
        },
        // Flipping the mode changes WHICH machines the schedule runs on — from
        // the live rule back to the stored join rows — and what each row's
        // `assigned` flag means, without the payload saying either. So every
        // cached device connection is stale and none can be patched from what
        // came back: the record is marked invalid instead, which sends the next
        // read of any of them to the network. Anything ALREADY on screen is
        // re-read by `onSaved` — invalidation only governs the next read, not a
        // query that is already mounted and subscribed.
        updater: store => {
          store.get(schedule.id)?.invalidateRecord();
        },
        onCompleted: () => {
          toast({
            title: 'Targeting updated',
            description: 'This schedule now runs on the devices assigned to it.',
            variant: 'success',
          });
          onSaved?.();
        },
        onError: error => {
          toast({
            title: 'Error',
            description: getRelayErrorMessage(error, 'Failed to switch device targeting'),
            variant: 'destructive',
          });
          onFailed?.();
        },
      });
    },
    [commitUpdate, schedule, toast],
  );

  return { saveSpecificMode, isSavingMode };
}
