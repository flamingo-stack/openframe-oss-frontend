'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  AlertTriangleIcon,
  AnthropicLogoIcon,
  GeminiLogoIcon,
  OpenaiLogoGreyIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ComponentType, Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { modelTokenRatesQuery as ModelTokenRatesQueryType } from '@/__generated__/modelTokenRatesQuery.graphql';

const PROVIDER_ICON: Record<string, ComponentType<{ className?: string }>> = {
  ANTHROPIC: AnthropicLogoIcon,
  OPENAI: OpenaiLogoGreyIcon,
  GOOGLE_GEMINI: GeminiLogoIcon,
};

const SKELETON_ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10'] as const;

const modelTokenRatesQuery = graphql`
  query modelTokenRatesQuery {
    aiModelRates {
      modelName
      displayName
      providerType
      inputTokenRate
      outputTokenRate
    }
  }
`;

function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1) return `${Math.round(value)}:1`;
  return `1:${Math.round(1 / value)}`;
}

/**
 * Two self-contained boundaries, because this is a TOOLTIP: nothing it does may
 * reach the page it is opened from.
 *
 * Suspense — the rates query is fetched lazily on open, so it must not suspend
 * the page-level boundary (that would flash the full-page skeleton). It falls
 * back to a local skeleton instead.
 *
 * ErrorBoundary — `aiModelRates` is `[AiModelRate!]!`, and a locked workspace has
 * it refused with `SUBSCRIPTION_TRIAL_EXPIRED`. Non-null means the refusal nulls
 * the whole payload, which Relay throws on; unbounded that throw reached the root
 * and took down the paywall — the one screen a locked workspace must be able to
 * use.
 *
 * The fallback keeps the tooltip's own frame and says what happened, rather than
 * rendering nothing: this opens on a deliberate click, and a panel that flashes
 * open empty reads as a broken control. It also says the part that matters — the
 * rates are a reference, and not knowing them changes nothing about the plan the
 * user is here to choose.
 */
export function ModelTokenRates() {
  return (
    <ErrorBoundary fallback={<ModelTokenRatesUnavailable />}>
      <Suspense fallback={<ModelTokenRatesSkeleton />}>
        <ModelTokenRatesContent />
      </Suspense>
    </ErrorBoundary>
  );
}

/** Same panel, same chrome — only the rows are replaced by why they are missing. */
function ModelTokenRatesUnavailable() {
  return (
    <div className="flex min-w-[260px] max-w-[320px] flex-col items-center gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)] text-center">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary">
        <AlertTriangleIcon className="size-5" />
      </div>
      <p className="text-ods-text-primary text-h3">Rates unavailable</p>
      <p className="text-ods-text-secondary text-h6">
        We couldn't load the per-model token rates. They're a reference only — your plan and its price are unaffected.
      </p>
    </div>
  );
}

function ModelTokenRatesContent() {
  const data = useLazyLoadQuery<ModelTokenRatesQueryType>(
    modelTokenRatesQuery,
    {},
    {
      // Opened from the plan picker, which the lock screen shows — so it has to
      // load on a locked workspace too (see `subscription-gate.ts`).
      fetchPolicy: 'store-and-network',
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );
  const rates = data.aiModelRates;

  if (rates.length === 0) return null;

  return (
    <div className="flex max-h-[min(60vh,420px)] min-w-[260px] flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      <div className="flex shrink-0 items-center gap-2 border-b border-ods-border px-3 py-2 uppercase tracking-[-0.02em] text-ods-text-secondary text-h5">
        <span className="flex-1">Model</span>
        <span>OpenFrame Token</span>
      </div>
      {/* Scroll the rows when the model list is taller than the capped height; the header stays pinned. */}
      <div className="flex flex-col overflow-y-auto">
        {rates.map(rate => {
          const Icon = PROVIDER_ICON[rate.providerType];
          return (
            <div key={`${rate.providerType}-${rate.modelName}`} className="flex items-center gap-2 px-3 py-2">
              {Icon && <Icon className="size-6 shrink-0" />}
              <span className="whitespace-nowrap text-ods-text-primary text-h6">
                {rate.displayName || rate.modelName}
              </span>
              <div className="h-px min-w-8 flex-1 bg-ods-border" />
              <span className="whitespace-nowrap text-ods-text-primary text-h6">
                {formatRate(rate.inputTokenRate)}
                {rate.outputTokenRate !== rate.inputTokenRate && (
                  <span className="text-ods-text-secondary"> / {formatRate(rate.outputTokenRate)}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelTokenRatesSkeleton() {
  return (
    <div className="flex min-w-[260px] flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      <div className="flex items-center gap-2 border-b border-ods-border px-3 py-2">
        <Skeleton className="h-4 w-12" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-28" />
      </div>
      {SKELETON_ROW_KEYS.map(key => (
        <div key={key} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
