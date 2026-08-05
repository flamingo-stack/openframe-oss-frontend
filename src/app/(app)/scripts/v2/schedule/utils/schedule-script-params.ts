import type { ScriptArgument } from '@flamingo-stack/openframe-frontend-core';
import { serializeKeyValues } from '../../../utils/script-key-values';
import { envVarsToInput, type ScriptEnvVarInput } from '../../shared/utils/script-mappers';

/**
 * "Custom scripts" — the per-script arguments / environment variables a schedule
 * runs a script with instead of the script's own defaults.
 *
 * The backend stores them as `ScriptSchedule.scriptCustomParams`, a **sparse**
 * list keyed by `scriptId`: an entry exists only for a script the user actually
 * customised, and each of its two fields is null when that half still inherits
 * the script's default. Both write inputs take the same shape with PUT
 * semantics — whatever is sent replaces the stored set entirely, and sending
 * nothing clears it.
 *
 * Two consequences this module exists to handle:
 *
 * 1. **Inheritance is per field.** Overriding the arguments must not freeze a
 *    copy of the env vars beside them, or a later edit to the script would stop
 *    reaching the schedule. So an override is emitted only for the half that
 *    differs from the default (see {@link collectScriptCustomParams}).
 * 2. **The key is the script, not the position.** A schedule may legitimately
 *    run the same script more than once ("A, B, A" is a real recipe), and the
 *    schema has no per-entry id — so both occurrences necessarily share one
 *    override. The form flags a conflict rather than silently keeping one set of
 *    values (see the duplicate rule in `edit-schedule.types.ts`).
 */

/** Env vars as the schema returns them — `secret` included, `value` nullable. */
type StoredEnvVars = ReadonlyArray<{
  readonly name: string;
  readonly value?: string | null;
  readonly secret?: boolean | null;
}> | null;

/** One stored override, as the detail query and both mutations return it. */
export interface StoredScriptCustomParams {
  readonly scriptId: string;
  readonly args?: ReadonlyArray<string> | null;
  readonly envVars?: StoredEnvVars;
}

/**
 * Stored env vars → the write shape. `secret` survives the round trip even
 * though nothing in the form displays it; see {@link withDefaultSecrets}.
 */
export function toEnvVarInputs(envVars: StoredEnvVars | undefined): ScriptEnvVarInput[] {
  return (envVars ?? []).map(e => ({ name: e.name, value: e.value ?? '', secret: e.secret ?? false }));
}

/** One override, in the shape `ScheduledScriptCustomParamsInput` expects. */
export interface ScriptCustomParamsInput {
  scriptId: string;
  /** Full replacement for the script's `defaultArgs`; null inherits them. */
  args: string[] | null;
  /** Full replacement for the script's `envVars`; null inherits them — NOT merged. */
  envVars: ScriptEnvVarInput[] | null;
}

/** The run parameters a script entry carries in the form, plus its defaults. */
export interface ScriptParamsEntry {
  scriptId: string;
  args: ScriptArgument[];
  envVars: ScriptArgument[];
  /** The picked script's own `defaultArgs` — what an absent override inherits. */
  defaultArgs: string[];
  /** The picked script's own `envVars` — likewise. */
  defaultEnvVars: ScriptEnvVarInput[];
}

/** Stored overrides by `scriptId`, for looking one up while seeding the form. */
export function customParamsByScriptId(
  params: ReadonlyArray<StoredScriptCustomParams> | null | undefined,
): Map<string, StoredScriptCustomParams> {
  return new Map((params ?? []).map(entry => [entry.scriptId, entry]));
}

/**
 * What a script in this schedule actually runs with: the override where there is
 * one, the script's own default everywhere else.
 *
 * Field by field, and `??` deliberately — an override with `args: []` means "no
 * arguments", which is a real customisation and must not fall through to the
 * default the way a null does.
 */
export function effectiveScriptParams(
  script: { readonly defaultArgs?: ReadonlyArray<string> | null; readonly envVars?: StoredEnvVars },
  custom: StoredScriptCustomParams | undefined,
): { args: string[]; envVars: ScriptEnvVarInput[] } {
  return {
    args: [...(custom?.args ?? script.defaultArgs ?? [])],
    envVars: toEnvVarInputs(custom?.envVars ?? script.envVars),
  };
}

function sameArgs(a: string[], b: ReadonlyArray<string>): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Env vars compared on name + value only. `secret` has no control in the form —
 * it is carried over from the default below rather than compared, so a schedule
 * never turns a secret variable into a plain one just by being saved.
 */
function sameEnvVars(a: ScriptEnvVarInput[], b: ReadonlyArray<ScriptEnvVarInput>): boolean {
  return a.length === b.length && a.every((entry, i) => entry.name === b[i].name && entry.value === b[i].value);
}

/**
 * The form's script rows → the sparse `scriptCustomParams` to send.
 *
 * A row contributes nothing when both halves still equal the script's defaults —
 * which is what keeps a schedule inheriting later edits to the script itself.
 * Repeated scripts collapse to their first row; the form rejects the case where
 * the repeats disagree, so this only ever drops an identical duplicate.
 */
export function collectScriptCustomParams(entries: ReadonlyArray<ScriptParamsEntry>): ScriptCustomParamsInput[] {
  const byScriptId = new Map<string, ScriptCustomParamsInput>();

  for (const entry of entries) {
    if (!entry.scriptId || byScriptId.has(entry.scriptId)) continue;

    const args = serializeKeyValues(entry.args, ' ');
    const envVars = withDefaultSecrets(envVarsToInput(entry.envVars), entry.defaultEnvVars);
    const argsChanged = !sameArgs(args, entry.defaultArgs);
    const envChanged = !sameEnvVars(envVars, entry.defaultEnvVars);

    if (!argsChanged && !envChanged) continue;
    byScriptId.set(entry.scriptId, {
      scriptId: entry.scriptId,
      args: argsChanged ? args : null,
      envVars: envChanged ? envVars : null,
    });
  }

  return [...byScriptId.values()];
}

/**
 * Restores the `secret` flag the form cannot hold, by name.
 *
 * `ScriptEnvVarInput.secret` is non-null and the key/value editor has no control
 * for it, so every pair would otherwise go out as `secret: false` — and editing
 * one variable of a schedule would quietly declassify the secret one next to it.
 * A variable the user renamed or added has no default to inherit from and stays
 * non-secret, which is the safe direction.
 */
function withDefaultSecrets(
  envVars: ScriptEnvVarInput[],
  defaults: ReadonlyArray<ScriptEnvVarInput>,
): ScriptEnvVarInput[] {
  const secretByName = new Map(defaults.map(e => [e.name, e.secret]));
  return envVars.map(entry => ({ ...entry, secret: secretByName.get(entry.name) ?? entry.secret }));
}
