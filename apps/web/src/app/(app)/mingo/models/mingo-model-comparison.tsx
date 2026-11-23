import { ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatTokenRate, TOKEN_RATE_EMPTY } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ProviderModelOption } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import type { AIProvider } from '@/generated/schema-enums';

export interface ModelDetails {
  released: string;
  description: string;
  recommended?: boolean;
}

/** Provider release dates and task descriptions based on the Mingo comparison design. */
const MODEL_DETAILS: Partial<Record<AIProvider, Record<string, ModelDetails>>> = {
  ANTHROPIC: {
    'claude-sonnet-5-5': { released: '2026-09-28', description: 'Best for routine requests' },
    'claude-opus-5-5': {
      released: '2026-09-22',
      description: 'Best for complex work',
      recommended: true,
    },
    'claude-opus-5': { released: '2026-07-24', description: 'Good for long tasks' },
    'claude-sonnet-5': { released: '2026-06-30', description: 'Best for simple lookups' },
    'claude-fable-5': { released: '2026-06-09', description: 'Best for open questions' },
    'claude-opus-4-8': { released: '2026-05-28', description: 'Best for simple tasks' },
    'claude-opus-4-7': { released: '2026-04-16', description: 'Previous generation' },
    'claude-sonnet-4-6': { released: '2026-02-17', description: 'Best for basic questions' },
  },
  OPENAI: {
    'gpt-6.1-terra': {
      released: '2026-10-26',
      description: 'Best for tasks with strict rules',
      recommended: true,
    },
    'gpt-6.1-sol': { released: '2026-09-29', description: 'Best for complex work' },
    'gpt-6-sol': { released: '2026-09-22', description: 'Best for routine requests' },
    'gpt-6-luna': { released: '2026-09-22', description: 'Best for everyday work' },
    'gpt-6-astra': { released: '2026-09-03', description: 'Good for long tasks' },
    'gpt-5.6-sol': { released: '2026-07-09', description: 'Best for simple lookups' },
    'gpt-5.6-terra': { released: '2026-07-09', description: 'Best for simple tasks' },
    'gpt-5.6-luna': { released: '2026-07-09', description: 'Best for basic questions' },
    'gpt-5.5': { released: '2026-04-24', description: 'Best for hard, multi-step tasks' },
  },
};

export function comparisonOptions(provider: AIProvider, options: readonly ProviderModelOption[]) {
  const models = MODEL_DETAILS[provider];
  return options
    .map(option => ({
      ...option,
      details: models && Object.hasOwn(models, option.value) ? models[option.value] : undefined,
    }))
    .sort((a, b) => (b.details?.released ?? '').localeCompare(a.details?.released ?? ''));
}

export interface Prices {
  rates: string;
  prices: string;
}

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const preciseUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatUsdPerMillion(rate: number | undefined, standardPrice: number) {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return TOKEN_RATE_EMPTY;
  const price = rate * standardPrice;
  return (price >= 10 ? compactUsd : preciseUsd).format(price);
}

export function comparisonPrices(rate: { input: number; output: number } | undefined, standardPrice: number): Prices {
  return {
    rates: `${formatTokenRate(rate?.input)} / ${formatTokenRate(rate?.output)}`,
    prices: `${formatUsdPerMillion(rate?.input, standardPrice)} / ${formatUsdPerMillion(rate?.output, standardPrice)}`,
  };
}

export function comparisonDescription(details: ModelDetails | undefined, pricing: Prices) {
  const description = details ? `${details.description}. ` : '';
  const recommended = details?.recommended ? 'Recommended. ' : '';
  return `${recommended}${description}Read and write rates: ${pricing.rates}. USD per million: ${pricing.prices}.`;
}

export function ModelComparisonRow({
  label,
  details,
  pricing,
}: {
  label: string;
  details: ModelDetails | undefined;
  pricing: Prices;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-[var(--spacing-system-sf)]">
        <span className="min-w-0 break-words text-[length:var(--font-size-menu-label)] font-medium leading-[var(--font-line-space-menu-label)] text-ods-text-primary">
          {label}
        </span>
        {details?.recommended && (
          <Tag as="span" label={<span>Recommended</span>} variant="primary" size="stamp" className="shrink-0" />
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-[var(--spacing-system-sf)] text-[length:var(--font-size-menu-description)] leading-[var(--font-line-space-menu-label)] text-ods-text-panel-secondary">
        {details && <span className="flex-auto">{details.description}</span>}
        <span className="ml-auto flex flex-wrap justify-end gap-x-[var(--spacing-system-xsf)]">
          <span className="whitespace-nowrap">{pricing.rates}</span>
          <span className="whitespace-nowrap">{pricing.prices}</span>
        </span>
      </div>
    </div>
  );
}

export function ModelComparisonFooter() {
  return (
    <div className="min-w-0 break-words text-[length:var(--font-size-menu-note)] leading-[var(--font-line-space-menu-note)] text-ods-text-panel-secondary">
      <div className="px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
        <p>Rate: OpenFrame tokens charged per token read / written.</p>
        <p>Price: per 1M tokens, read / write.</p>
      </div>
      <div className="flex items-start gap-[var(--spacing-system-xsf)] border-t border-ods-border px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
        <ShieldCheckIcon size={16} className="shrink-0" aria-hidden />
        <p>
          Your chats aren’t used to train AI models. Model providers may retain requests and responses for up to 30
          days.
        </p>
      </div>
    </div>
  );
}
