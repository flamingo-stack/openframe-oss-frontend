'use client';

import { Label } from '@flamingo-stack/openframe-frontend-core';
import { type ScriptParamRow, ScriptParamRows } from '../../shared/components/script-param-rows';

interface ScriptArgumentsCardProps {
  title: string;
  /** Built by `argsToParamRows` / `envPairsToParamRows`, which own how a valueless or secret entry reads. */
  rows: ScriptParamRow[];
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
export function ScriptArgumentsCard({ title, rows }: ScriptArgumentsCardProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <Label className="w-full text-ods-text-secondary text-h5">{title}</Label>
      <div className="w-full rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <ScriptParamRows rows={rows} />
      </div>
    </div>
  );
}
