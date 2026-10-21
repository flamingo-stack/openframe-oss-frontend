'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Copy02Icon, ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DirectoryProvider } from '@/generated/schema-enums';
import {
  CONSENT_ACTIONS_CLASSES,
  CONSENT_CARD_CLASSES,
  CONSENT_LINK_INPUT_CLASSES,
  type ConsentMode,
  ConsentLinkPanel,
  type ConsentPanelProps,
  LINK_PLACEHOLDER,
} from './consent-link-panel';
import { MicrosoftConsentPanel } from './microsoft-consent-panel';

export type { ConsentMode, ConsentPanelProps as ConsentBlockProps } from './consent-link-panel';

/**
 * The seam every page renders the consent step through. Dispatches on the
 * provider so the Microsoft implementation can diverge (see
 * `microsoft-consent-panel.tsx`) without the New, Reconnect or details page
 * learning about it. In a loading scope (before the record is known) it draws its own loading state, which needs
 * only the mode: nothing else of `props` is read.
 */
export function ConsentBlock(props: ConsentPanelProps) {
  if (useLoadingScope()) {
    return <ConsentBlockSkeleton mode={props.mode} />;
  }
  if (props.provider === DirectoryProvider.MICROSOFT_365) {
    return <MicrosoftConsentPanel {...props} />;
  }
  return <ConsentLinkPanel {...props} />;
}

/**
 * `ConsentLinkPanel` before the record is known: the same frame, field and buttons, locked. Only the
 * instruction is a text bar — it names the provider, which the record has not said yet — of the two lines it
 * runs to at the card's usual width.
 */
function ConsentBlockSkeleton({ mode }: { mode: ConsentMode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-label="Grant admin consent">
      {/* The details page draws no caption row, as `ConsentLinkPanel` does. */}
      {mode !== 'details' && (
        <div className="flex items-center justify-between gap-[var(--spacing-system-xs)]">
          <p className="text-ods-text-secondary text-h5">Grant admin consent</p>
          {/* The connect step offers Edit Domain until the admin has consented; locked, it keeps the row's height. */}
          {mode === 'new' && (
            <Button variant="link" size="compact" className="underline underline-offset-2" disabled>
              Edit Domain
            </Button>
          )}
        </div>
      )}
      <div className={CONSENT_CARD_CLASSES}>
        <TextLineSkeleton type="h4" lines={2} />
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
