'use client';

import { InfoCell } from '@/app/components/shared/info-cell';

interface GuardrailsPresetCardProps {
  label: string;
  /** Muted value — the preset is inherited from the tenant defaults. */
  muted?: boolean;
}

/** Read-only "Guardrails Preset" summary card. */
export function GuardrailsPresetCard({ label, muted = false }: GuardrailsPresetCardProps) {
  return (
    <div className="flex min-h-20 items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-mf)]">
      <InfoCell
        value={muted ? <span className="text-ods-text-secondary">{label}</span> : label}
        label="Guardrails Preset"
      />
    </div>
  );
}
