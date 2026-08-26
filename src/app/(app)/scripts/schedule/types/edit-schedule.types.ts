import { OS_PLATFORMS } from '@flamingo-stack/openframe-frontend-core/utils';
import { z } from 'zod';
import { ScriptScheduleTrigger } from '@/generated/schema-enums';
import { parseKeyValues, serializeKeyValues } from '../../shared/utils/script-key-values';
import { envVarsToInput, envVarsToPairs, platformsToIds } from '../../shared/utils/script-mappers';
import { customParamsByScriptId, effectiveScriptParams, toEnvVarInputs } from '../utils/schedule-script-params';
import {
  dateToTimeSlot,
  fromScheduleInstant,
  isEventTrigger,
  isStartInPastAndChanged,
  MIN_REPEAT_MINUTES,
  PAST_START_MESSAGE,
  REPEAT_UNIT_VALUES,
  secondsToRepeatParts,
  startOfToday,
} from '../utils/schedule-timing';
import type { ScheduleDetailData } from './schedule-detail.types';

/** Fallback when a script carries no timeout of its own (design default). */
const DEFAULT_TIMEOUT_SECONDS = 90;

const keyValueSchema = z.object({ id: z.string(), key: z.string(), value: z.string() });

/**
 * UI platform id → its display name ("darwin" → "MacOS"). Reads the FULL
 * platform list, not `AVAILABLE_PLATFORMS`: Linux is hidden from the selector,
 * but a schedule authored elsewhere can still carry it, and that is exactly the
 * mismatch worth naming.
 */
export function platformLabel(id: string): string {
  return OS_PLATFORMS.find(p => p.id === id)?.name ?? id;
}

// `trigger` decides whether the timing block applies at all: DATE_TIME is the
// time-driven model below; DEVICE_ONLINE is event-driven and the backend keeps
// `startAt` / `repeat` null for it, so the whole Date & Time row is hidden and
// both fields are submitted as null.
//
// Timing maps to two backend fields: `startAt` (UTC Instant on a 30-min
// boundary — the Time dropdown only offers slots that land on it) and `repeat`
// (Long seconds). Both form fields hold the user's LOCAL clock; the conversion
// happens once, on submit, in `toScheduleInstant`. The
// day and the time of day are kept as SEPARATE form fields and only combined on
// submit: a single `Date` cannot tell "date picked, time not chosen yet" from
// "midnight", which is exactly the case the required-field rule below has to
// catch. A "Run on schedule" trigger has no meaning without both, so both are
// required for DATE_TIME (which also subsumes the old "repeat needs a start to
// anchor it" rule).
//
// `scripts[]` order IS the run order — it is submitted as `scriptIds` verbatim,
// so dragging a card is a real, persisted change. `args` / `envVars` are per-
// script run parameters the schedule DOES store now, as the sparse
// `scriptCustomParams` (see `utils/schedule-script-params.ts`): they are seeded
// from the stored override where there is one and from the script's own defaults
// otherwise, and only the halves that still differ from those defaults are
// written back. `timeoutSeconds` remains the one field with nowhere to go — the
// override input carries no timeout — so it is still seeded from the script and
// dropped on submit (docs/script-schedules-graphql-gaps.md §3).
export const editScheduleFormSchema = z
  .object({
    name: z.string().min(1, 'Please enter a schedule name').max(255, 'Name must not exceed 255 characters'),
    description: z.string(),
    trigger: z.enum([ScriptScheduleTrigger.DATE_TIME, ScriptScheduleTrigger.DEVICE_ONLINE]),
    scheduledDate: z.date().nullable(),
    /** `HH:mm` on the 30-minute grid; `''` = the user hasn't picked a time yet. */
    scheduledTime: z.string(),
    repeatEnabled: z.boolean(),
    repeatInterval: z.number().int().min(1, 'Interval must be at least 1'),
    repeatUnit: z.enum(REPEAT_UNIT_VALUES),
    /**
     * The `repeat` seconds this form was seeded with, carried along with no
     * control of its own. The interval/unit pair cannot express a sub-hour
     * cadence, so a schedule authored elsewhere displays rounded — and this is
     * what lets Save write the original back untouched (`resolveRepeatSeconds`)
     * instead of rewriting the cadence on an unrelated edit. `null` when
     * creating, or when the schedule has no recurrence.
     */
    repeatSecondsStored: z.number().nullable(),
    /**
     * The `startAt` this form was seeded with, carried with no control of its
     * own — the same contract as `repeatSecondsStored` above, for the same
     * reason. A schedule whose start has already passed is perfectly normal (a
     * recurring one runs off `repeat` from there), and the "no start in the past"
     * rule below would otherwise make every such schedule unsaveable: renaming
     * one would demand re-picking its date. So the stored instant stays legal for
     * as long as the form still shows exactly it; the moment the user moves the
     * date or the time, their choice has to be in the future like any other.
     */
    startAtStored: z.string().nullable(),
    supportedPlatforms: z.array(z.string()).min(1, 'Please select at least one platform'),
    scripts: z
      .array(
        z
          .object({
            scriptId: z.string().min(1, 'Please select a script'),
            name: z.string(),
            /** The picked script's OWN platforms — checked against the schedule's below. */
            supportedPlatforms: z.array(z.string()),
            // 0 = no script picked yet, so the field is locked and empty; a real
            // timeout only exists once a script is chosen (it seeds this).
            timeoutSeconds: z.number().int().min(0),
            args: z.array(keyValueSchema),
            envVars: z.array(keyValueSchema),
            /**
             * The picked script's OWN defaults, carried with no control of their
             * own: an override is written only for the half that differs from
             * them, so a schedule keeps inheriting later edits to the script
             * instead of freezing a copy the day it was saved.
             */
            defaultArgs: z.array(z.string()),
            defaultEnvVars: z.array(z.object({ name: z.string(), value: z.string(), secret: z.boolean() })),
          })
          .refine(entry => !entry.scriptId || entry.timeoutSeconds >= 1, {
            message: 'Timeout must be at least 1 second',
            path: ['timeoutSeconds'],
          }),
      )
      .min(1, 'Please add at least one script'),
  })
  // Cross-field rules — `superRefine` (not chained `.refine`s) so one submit
  // flags every offending field at once instead of walking the user through
  // them one save at a time.
  .superRefine((data, ctx) => {
    // A schedule dispatches every script to every platform it targets, so a
    // script that doesn't cover one of them simply never runs there — silently.
    // The picker only narrows candidates to scripts overlapping the schedule's
    // platforms, so a partial match (Windows-only script on a Windows + Linux
    // schedule) is reachable and has to be caught here. Flagged on the row,
    // where both fixes live: swap the script or drop the platform.
    data.scripts.forEach((entry, index) => {
      if (!entry.scriptId) return;
      const unsupported = data.supportedPlatforms.filter(p => !entry.supportedPlatforms.includes(p));
      if (unsupported.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `This script doesn't support ${unsupported.map(platformLabel).join(', ')}`,
          path: ['scripts', index, 'scriptId'],
        });
      }
    });

    // One override per SCRIPT, not per row: `scriptCustomParams` is keyed by
    // `scriptId` and the schema has no per-position id, so two rows running the
    // same script cannot carry different arguments. The picker allows the repeat
    // on purpose ("A, B, A" is a real recipe) — what it cannot allow is the
    // repeats disagreeing, since saving would silently keep one row's values and
    // apply them to both. Flagged on the later row, the one to fix.
    const paramsByScriptId = new Map<string, string>();
    data.scripts.forEach((entry, index) => {
      if (!entry.scriptId) return;
      const params = JSON.stringify([serializeKeyValues(entry.args, ' '), envVarsToInput(entry.envVars)]);
      const seen = paramsByScriptId.get(entry.scriptId);
      if (seen === undefined) {
        paramsByScriptId.set(entry.scriptId, params);
        return;
      }
      if (seen !== params) {
        ctx.addIssue({
          code: 'custom',
          message: 'This script runs twice in the schedule — both entries must use the same arguments and env vars',
          path: ['scripts', index, 'scriptId'],
        });
      }
    });

    // "Run on schedule" fires at a wall-clock instant, so it needs both halves
    // of one. Event-driven schedules carry no timing at all — their controls are
    // collapsed and both fields are submitted as null.
    if (isEventTrigger(data.trigger)) return;
    if (data.scheduledDate == null) {
      ctx.addIssue({ code: 'custom', message: 'Please select a start date', path: ['scheduledDate'] });
    }
    if (!data.scheduledTime) {
      ctx.addIssue({ code: 'custom', message: 'Please select a start time', path: ['scheduledTime'] });
    }

    // A start in the past is not a schedule — the backend would either fire it
    // immediately or refuse it. The time dropdown already withholds today's gone
    // slots and the fields flag a past day as it is picked; this is the rule that
    // actually refuses the save, and it also catches what no control can: a form
    // left open long enough for its own slot to go by. Exempt while the pair
    // still reads exactly the stored `startAt` — see `isStartInPastAndChanged`.
    if (isStartInPastAndChanged(data.scheduledDate, data.scheduledTime, data.startAtStored)) {
      ctx.addIssue({
        code: 'custom',
        message: PAST_START_MESSAGE,
        // On the field the user can act on: a past DAY is the date's problem,
        // a past slot of today is the time's.
        path: [data.scheduledDate && data.scheduledDate < startOfToday() ? 'scheduledDate' : 'scheduledTime'],
      });
    }

    // The runner ticks on a 30-minute grid, so a cadence has to be a whole
    // number of those slots. Only the Minute unit can express one that isn't —
    // an hour is already two slots — and the `.min(1)` above rules out zero, so
    // "a multiple of 30" is the whole rule, floor included.
    if (data.repeatEnabled && data.repeatUnit === 'minute' && data.repeatInterval % MIN_REPEAT_MINUTES !== 0) {
      ctx.addIssue({
        code: 'custom',
        // Names the half of the rule the value actually broke. One combined
        // message would have to say both, and both does not fit: this renders
        // under a narrow quarter-row field and ellipsises past ~20 characters,
        // where a truncated rule is worse than no rule at all.
        message:
          data.repeatInterval < MIN_REPEAT_MINUTES
            ? `Minimum ${MIN_REPEAT_MINUTES} minutes`
            : `Use multiples of ${MIN_REPEAT_MINUTES}`,
        path: ['repeatInterval'],
      });
    }
  });

export type EditScheduleFormData = z.infer<typeof editScheduleFormSchema>;

export const EMPTY_SCRIPT_ROW: EditScheduleFormData['scripts'][number] = {
  scriptId: '',
  name: '',
  supportedPlatforms: [],
  // 0 keeps the Timeout field locked and empty until a script is picked.
  timeoutSeconds: 0,
  args: [],
  envVars: [],
  defaultArgs: [],
  defaultEnvVars: [],
};

export const TRIGGER_OPTIONS = [
  {
    value: ScriptScheduleTrigger.DATE_TIME,
    label: 'Run on schedule',
    description: 'Runs at the set date and time, whether or not the device is online.',
  },
  {
    value: ScriptScheduleTrigger.DEVICE_ONLINE,
    label: 'Run when device comes online',
    description: "Waits for the device to connect, then runs as soon as it's reachable.",
  },
];

export const DEFAULT_SCHEDULE_VALUES: EditScheduleFormData = {
  name: '',
  description: '',
  trigger: ScriptScheduleTrigger.DATE_TIME,
  scheduledDate: null,
  scheduledTime: '',
  repeatEnabled: false,
  repeatInterval: 1,
  repeatUnit: 'day',
  repeatSecondsStored: null,
  startAtStored: null,
  supportedPlatforms: ['windows'],
  scripts: [EMPTY_SCRIPT_ROW],
};

/** The stored schedule, in the shape the edit form holds it. */
export function scheduleToFormValues(schedule: ScheduleDetailData): EditScheduleFormData {
  const repeatParts = schedule.repeat ? secondsToRepeatParts(schedule.repeat) : null;
  // The stored instant carries both halves; the form keeps them apart.
  const startAt = schedule.startAt ? fromScheduleInstant(schedule.startAt) : null;
  // Overrides are sparse and keyed by script — a script with no entry runs on
  // its own defaults, and a script the schedule lists twice reads the same one.
  const customParams = customParamsByScriptId(schedule.scriptCustomParams);
  return {
    name: schedule.name,
    description: schedule.description ?? '',
    trigger: isEventTrigger(schedule.trigger) ? ScriptScheduleTrigger.DEVICE_ONLINE : ScriptScheduleTrigger.DATE_TIME,
    scheduledDate: startAt,
    scheduledTime: startAt ? dateToTimeSlot(startAt) : '',
    repeatEnabled: Boolean(schedule.repeat),
    repeatInterval: repeatParts?.interval ?? 1,
    repeatUnit: repeatParts?.unit ?? 'day',
    repeatSecondsStored: schedule.repeat ?? null,
    startAtStored: schedule.startAt ?? null,
    supportedPlatforms: platformsToIds(schedule.supportedPlatforms),
    scripts:
      schedule.scripts.length > 0
        ? schedule.scripts.map(s => {
            // What this schedule runs the script with: its override where there
            // is one, the script's own default for every half without.
            const effective = effectiveScriptParams(s, customParams.get(s.id));
            return {
              scriptId: s.id,
              name: s.name,
              supportedPlatforms: platformsToIds(s.supportedPlatforms),
              timeoutSeconds: s.defaultTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
              args: parseKeyValues(effective.args, ' '),
              envVars: envVarsToPairs(effective.envVars),
              defaultArgs: s.defaultArgs ? [...s.defaultArgs] : [],
              defaultEnvVars: toEnvVarInputs(s.envVars),
            };
          })
        : [EMPTY_SCRIPT_ROW],
  };
}
