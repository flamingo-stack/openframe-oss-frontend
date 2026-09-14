'use client';

import { Label } from '@flamingo-stack/openframe-frontend-core';
import { argsToParamRows, envStringsToParamRows, ScriptParamRows } from '../../shared/components/script-param-rows';

interface ScriptArgumentsCardProps {
  title: string;
  args: string[];
  /**
   * Also selects how a valueless entry reads: `' '` marks an argument list,
   * where a bare key is a flag; anything else marks env vars, where an empty
   * value is a legal setting. One knob, so the two can never disagree.
   */
  separator?: string;
}

/**
 * A titled card of `key ——— value` lines.
 *
 * Built on the shared {@link ScriptParamRows} rather than the core `InfoCard`:
 * that component types its values as plain strings, so an entry with no value
 * rendered as a leader line running into nothing. The rows here mark the empty
 * case explicitly (design 1:49182) — otherwise the frame is the same one
 * `InfoCard` draws.
 */
export function ScriptArgumentsCard({ title, args, separator = '=' }: ScriptArgumentsCardProps) {
  if (!args || args.length === 0) {
    return null;
  }

  const rows = separator === ' ' ? argsToParamRows(args) : envStringsToParamRows(args);

  return (
    <div className="flex w-full flex-col gap-1">
      <Label className="w-full text-ods-text-secondary text-h5">{title}</Label>
      <div className="w-full rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <ScriptParamRows rows={rows} />
      </div>
    </div>
  );
}
