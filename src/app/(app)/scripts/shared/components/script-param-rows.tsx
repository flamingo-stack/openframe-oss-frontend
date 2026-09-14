'use client';

import type { ScriptArgument } from '@flamingo-stack/openframe-frontend-core';
import { FloatingTooltip, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { parseKeyValues } from '../utils/script-key-values';

export interface ScriptParamRow {
  id: string;
  label: string;
  value: string;
  /** Renders the value in secondary text — a "no value" mark, not data. */
  muted?: boolean;
  /** Tooltip for the value; falls back to the value itself (truncation aid). */
  hint?: string;
}

/**
 * What the value column shows when a parameter carries no value.
 *
 * The wording comes from design 1:49182, which greys a word out instead of
 * printing a mark: a lone em dash left the row looking broken, while "flag"
 * states what the row actually means — the key is handed to the script on its
 * own. Muting is what keeps it from reading as a literal value spelled "flag";
 * the precise reason lives in the tooltip.
 */
const NO_ARG_VALUE = { value: 'flag', hint: 'Passed as a flag — no value' } as const;
const NO_ENV_VALUE = { value: 'empty', hint: 'Set to an empty value' } as const;

function toRow(pair: ScriptArgument, noValue: { value: string; hint: string }): ScriptParamRow {
  return pair.value
    ? { id: pair.id, label: pair.key, value: pair.value }
    : { id: pair.id, label: pair.key, value: noValue.value, hint: noValue.hint, muted: true };
}

/** "key value" strings → rows (a bare key is passed as a flag). */
export function argsToParamRows(args: ReadonlyArray<string>): ScriptParamRow[] {
  return parseKeyValues([...args], ' ').map(arg => toRow(arg, NO_ARG_VALUE));
}

/** "name=value" strings → rows (an empty value is legal: `FOO=`). */
export function envStringsToParamRows(envVars: ReadonlyArray<string>): ScriptParamRow[] {
  return parseKeyValues([...envVars], '=').map(env => toRow(env, NO_ENV_VALUE));
}

/** Already-parsed env pairs (e.g. from GraphQL `envVars`) → rows. */
export function envPairsToParamRows(pairs: ReadonlyArray<ScriptArgument>): ScriptParamRow[] {
  return pairs.map(env => toRow(env, NO_ENV_VALUE));
}

interface ScriptParamRowsProps {
  rows: ScriptParamRow[];
  /** Shown in place of the rows when there are none. */
  emptyText?: string;
  className?: string;
}

/**
 * The `key ——— value` lines of a script's arguments or environment variables,
 * unframed — the caller supplies the panel or card around them.
 *
 * The rule between the two ends is the design's leader line: it absorbs the
 * slack, so values stay flush right however long the keys are. Shared by the
 * schedule's script card and the script details page so "no value" means the
 * same thing, and looks the same, in both.
 */
export function ScriptParamRows({ rows, emptyText, className }: ScriptParamRowsProps) {
  return (
    <div className={cn('flex w-full flex-col gap-[var(--spacing-system-sf)]', className)}>
      {rows.length === 0
        ? emptyText && <span className="text-ods-text-secondary text-h6">{emptyText}</span>
        : rows.map(row => (
            <div key={row.id} className="flex h-6 w-full items-center gap-[var(--spacing-system-xs)]">
              <div className="min-w-0 max-w-[50%]">
                <TruncateText>{row.label}</TruncateText>
              </div>
              <span className="h-px min-w-4 flex-1 bg-ods-divider" />
              <div className="min-w-0">
                {row.hint ? (
                  /* The hint explains the muted mark ("flag"/"empty"), so it must show even when nothing overflows. */
                  <FloatingTooltip content={row.hint} className="max-w-xs">
                    <span className="block truncate text-ods-text-secondary text-h4">{row.value}</span>
                  </FloatingTooltip>
                ) : (
                  <TruncateText tone={row.muted ? 'secondary' : 'primary'}>{row.value}</TruncateText>
                )}
              </div>
            </div>
          ))}
    </div>
  );
}
