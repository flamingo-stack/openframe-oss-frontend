'use client';

import { PolicyValueCard } from '@/app/components/shared/policy-value-card';

interface GuardrailsPresetCardProps {
  /** Unread while loading. */
  label?: string;
  /** Muted value — the preset is inherited from the tenant defaults. */
  muted?: boolean;
}

/** Read-only "Guardrails Preset" summary card; in a loading scope (or with no preset yet) its value is a bar. */
export function GuardrailsPresetCard({ label, muted = false }: GuardrailsPresetCardProps) {
  return <PolicyValueCard label="Guardrails Preset" value={label} muted={muted} />;
}
