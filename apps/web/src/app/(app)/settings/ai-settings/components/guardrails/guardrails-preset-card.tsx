'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InfoCell } from '@/app/components/shared/info-cell';

interface GuardrailsPresetCardProps {
  /** Unread while loading. */
  label?: string;
  /** Muted value — the preset is inherited from the tenant defaults. */
  muted?: boolean;
}

const CARD_CLASS =
  'flex min-h-20 items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-mf)]';
const FIELD_LABEL = 'Guardrails Preset';

/** The card while the preset is on its way: the field's label is fixed copy, the preset a bar. */
export function GuardrailsPresetCardSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TextLineSkeleton type="h4" className="w-40 max-w-full" />
        <p className="truncate text-ods-text-secondary text-h6">{FIELD_LABEL}</p>
      </div>
    </div>
  );
}

/** Read-only "Guardrails Preset" summary card; in a loading scope, its skeleton. */
export function GuardrailsPresetCard({ label, muted = false }: GuardrailsPresetCardProps) {
  if (useLoadingScope() || label == null) return <GuardrailsPresetCardSkeleton />;
  return (
    <div className={CARD_CLASS}>
      <InfoCell value={muted ? <span className="text-ods-text-secondary">{label}</span> : label} label={FIELD_LABEL} />
    </div>
  );
}
