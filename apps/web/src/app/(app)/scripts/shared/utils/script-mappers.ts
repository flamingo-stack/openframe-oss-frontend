import type { ScriptArgument } from '@flamingo-stack/openframe-frontend-core';
// Value import: the generated module exports each enum as both a `const` (values)
// and a `type` under the same name, so these stand in for hardcoded literals.
import { OsType, PrivilegeLevel, ScriptShell } from '@/generated/schema-enums';
import { EDIT_SCRIPT_DEFAULT_VALUES, type EditScriptFormData } from '../types/edit-script.types';
import { parseKeyValues, serializeKeyValues } from './script-key-values';

/**
 * Translation layer between the UI's (tactical-shaped) form model and the
 * native OpenFrame GraphQL Script model. The v2 views intentionally reuse the
 * existing presentational components, so every model difference is contained
 * here.
 */

// ---------------------------------------------------------------------------
// Shell <-> ScriptShell enum
// ---------------------------------------------------------------------------

/** UI shell id is just the lowercased enum value — reverse map derived, not hardcoded. */
const SHELL_BY_ID: Record<string, ScriptShell> = Object.fromEntries(
  Object.values(ScriptShell).map(shell => [shell.toLowerCase(), shell]),
);

export function shellToEnum(shell: string): ScriptShell {
  return SHELL_BY_ID[shell?.toLowerCase()] ?? ScriptShell.SHELL;
}

/** Lowercase id consumed by ScriptShellBadge / ScriptInfoSection / the editor. */
export function shellToId(shell: ScriptShell | string | null | undefined): string {
  return (shell ?? ScriptShell.SHELL).toString().toLowerCase();
}

// ---------------------------------------------------------------------------
// Platform <-> OsType enum (UI ids: windows / darwin / linux)
// ---------------------------------------------------------------------------

/**
 * UI id per enum VALUE, keyed by the string rather than by `OsType.MAC_OS` &co.
 *
 * The backend has already renamed one member and dropped another in a single
 * schema refresh (`MACOS` -> `MAC_OS`, `LINUX` gone), and a table keyed on the
 * members would stop COMPILING on the next such refresh — turning a backend
 * question into a frontend build break. Keyed on strings, an entry the server no
 * longer offers is simply never reached, and one it brings back starts working
 * again with no edit here.
 *
 * `darwin` is the odd id out; the rest are just the lowercased enum value.
 */
const UI_ID_BY_OS_TYPE: Record<string, string> = {
  WINDOWS: 'windows',
  MAC_OS: 'darwin',
  MACOS: 'darwin',
  LINUX: 'linux',
};

/**
 * The reverse direction, derived from the enum ITSELF — so it only ever offers
 * platforms this schema actually has, and a UI checkbox for one it doesn't
 * cannot smuggle an unknown value into a query variable.
 */
const PLATFORM_ID_TO_ENUM: Record<string, OsType> = Object.fromEntries(
  Object.values(OsType).map(value => [UI_ID_BY_OS_TYPE[value] ?? value.toLowerCase(), value]),
);

export function platformsToEnums(ids: string[]): OsType[] {
  return ids.map(id => PLATFORM_ID_TO_ENUM[id?.toLowerCase()]).filter((v): v is OsType => !!v);
}

export function platformsToIds(enums: ReadonlyArray<OsType | string> | null | undefined): string[] {
  if (!enums) return [];
  return enums.map(e => UI_ID_BY_OS_TYPE[e as string]).filter((v): v is string => !!v);
}

// ---------------------------------------------------------------------------
// Env vars <-> ScriptEnvVar { name, value, secret }
// ---------------------------------------------------------------------------

export interface ScriptEnvVarInput {
  name: string;
  /**
   * `null` on a stored secret the user left alone — "keep what you hold". The
   * server masks a secret's value on every read, so the form has nothing else
   * to send back; on a write it resolves null against the stored secret of the
   * same name (400 when there is none, e.g. the first override a schedule
   * writes for a script), and a run merges over the stored vars and skips it.
   * `''` is a real value, legal for a plain variable and never sent for an
   * untouched secret. Null on a plain variable is rejected.
   */
  value: string | null;
  secret: boolean;
}

/** Env vars as the schema returns them: a secret comes back with `value: null`. */
export type StoredEnvVar = { readonly name: string; readonly value?: string | null; readonly secret?: boolean | null };

/** A stored secret the user has not replaced: the mask is showing, nothing was typed. */
function isUntouchedStoredSecret(pair: ScriptArgument): boolean {
  return Boolean(pair.secret && pair.hasStoredValue && !pair.value);
}

/**
 * Form key/value pairs -> GraphQL ScriptEnvVarInput[].
 *
 * An untouched stored secret goes out as `value: null` (keep), never as `''`.
 * Clearing a typed replacement brings the mask back and sends null again. A
 * secret the user just added goes out as typed, blank included.
 */
export function envVarsToInput(pairs: ScriptArgument[]): ScriptEnvVarInput[] {
  return pairs
    .filter(p => p.key.trim() !== '')
    .map(p => ({
      name: p.key,
      value: isUntouchedStoredSecret(p) ? null : (p.value ?? ''),
      secret: p.secret ?? false,
    }));
}

/**
 * GraphQL env vars -> form key/value pairs.
 *
 * A secret's `value` arrives as null (masked server-side) and seeds an empty
 * field flagged `hasStoredValue`, which is what makes the editor show a mask
 * instead of an empty prompt and {@link envVarsToInput} send null back.
 */
export function envVarsToPairs(envVars: ReadonlyArray<StoredEnvVar> | null | undefined): ScriptArgument[] {
  if (!envVars) return [];
  return envVars.map((e, i) => ({
    id: `env-${i}`,
    key: e.name,
    value: e.value ?? '',
    ...(e.secret && { secret: true, hasStoredValue: e.value == null }),
  }));
}

// ---------------------------------------------------------------------------
// Form payload -> Create / Update input
// ---------------------------------------------------------------------------

export interface ScriptWriteInput {
  name: string;
  description: string;
  shell: ScriptShell;
  privilegeLevel: PrivilegeLevel;
  scriptBody: string;
  supportedPlatforms: OsType[];
  defaultTimeoutSeconds: number;
  defaultArgs: string[];
  envVars: ScriptEnvVarInput[];
  /** Ids of existing Tag entities to assign — replaces the current set (PUT semantics). */
  tagIds: string[];
}

export function formToWriteInput(data: EditScriptFormData): ScriptWriteInput {
  return {
    name: data.name,
    description: data.description,
    shell: shellToEnum(data.shell),
    // `run_as_user` maps to the backend privilege level (USER vs elevated ADMIN).
    privilegeLevel: data.run_as_user ? PrivilegeLevel.USER : PrivilegeLevel.ADMIN,
    scriptBody: data.script_body,
    supportedPlatforms: platformsToEnums(data.supported_platforms),
    defaultTimeoutSeconds: data.default_timeout,
    // Args are stored as "key value" strings, matching the legacy tactical shape.
    defaultArgs: serializeKeyValues(data.args, ' '),
    envVars: envVarsToInput(data.env_vars),
    // Tag entities assigned via the tags picker; replaces the current set.
    tagIds: data.tag_ids,
  };
}

// ---------------------------------------------------------------------------
// Relay script node -> form values
// ---------------------------------------------------------------------------

export interface ScriptDetailNode {
  id: string;
  name: string;
  description?: string | null;
  shell: ScriptShell | string;
  privilegeLevel?: PrivilegeLevel | string | null;
  scriptBody: string;
  tags?: ReadonlyArray<{ id: string; key: string }> | null;
  supportedPlatforms?: ReadonlyArray<OsType | string> | null;
  defaultTimeoutSeconds?: number | null;
  defaultArgs?: ReadonlyArray<string> | null;
  envVars?: ReadonlyArray<StoredEnvVar> | null;
}

export function relayScriptToForm(node: ScriptDetailNode): EditScriptFormData {
  return {
    name: node.name ?? '',
    shell: shellToId(node.shell),
    default_timeout: node.defaultTimeoutSeconds ?? EDIT_SCRIPT_DEFAULT_VALUES.default_timeout,
    args: parseKeyValues(node.defaultArgs ? [...node.defaultArgs] : [], ' '),
    script_body: node.scriptBody ?? '',
    run_as_user: node.privilegeLevel === PrivilegeLevel.USER,
    env_vars: envVarsToPairs(node.envVars),
    description: node.description ?? '',
    supported_platforms: platformsToIds(node.supportedPlatforms),
    category: node.tags?.[0]?.key ?? '',
    tag_ids: node.tags?.map(t => t.id) ?? [],
  };
}
