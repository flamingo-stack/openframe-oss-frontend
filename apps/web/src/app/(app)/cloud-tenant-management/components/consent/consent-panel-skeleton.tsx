'use client';

import { Copy02Icon, ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InlineSkeleton } from '@/app/components/shared';
import {
  CONSENT_ACTIONS_CLASSES,
  CONSENT_CARD_CLASSES,
  CONSENT_LINK_INPUT_CLASSES,
  type ConsentMode,
  LINK_PLACEHOLDER,
} from './consent-link-panel';

/**
 * `ConsentLinkPanel` before the record is known: the same frame, field and buttons, locked. Only the
 * instruction is bars — it names the provider, which the record has not said yet — two of them, the
 * lines it runs to at the card's usual width.
 */
export function ConsentPanelSkeleton({ mode }: { mode: Exclude<ConsentMode, 'details'> }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-label="Grant admin consent" aria-busy>
      <div className="flex items-center justify-between gap-[var(--spacing-system-xs)]">
        <p className="text-ods-text-secondary text-h5">Grant admin consent</p>
        {/* The connect step offers Edit Domain until the admin has consented; locked, it keeps the row's height. */}
        {mode === 'new' && (
          <Button variant="link" size="compact" className="underline underline-offset-2" disabled>
            Edit Domain
          </Button>
        )}
      </div>
      <div className={CONSENT_CARD_CLASSES}>
        <div className="flex flex-col">
          <InlineSkeleton className="h-6 w-full" />
          <InlineSkeleton className="h-6 w-2/3" />
        </div>
        <Input
          readOnly
          disabled
          value=""
          placeholder={LINK_PLACEHOLDER[mode]}
          aria-label="Consent link"
          className={CONSENT_LINK_INPUT_CLASSES}
          endAdornment={
            <span className="flex items-center gap-[var(--spacing-system-xxs)]">
              <Button variant="transparent" size="icon-sm" aria-label="Copy consent link" disabled>
                <Copy02Icon className="text-ods-text-secondary" />
              </Button>
              <Button variant="transparent" size="icon-sm" aria-label="Open consent link" disabled>
                <ExternalLinkIcon className="text-ods-text-secondary" />
              </Button>
            </span>
          }
        />
        <div className={CONSENT_ACTIONS_CLASSES}>
          <Button variant="outline" disabled>
            Check Connection
          </Button>
        </div>
      </div>
    </section>
  );
}
