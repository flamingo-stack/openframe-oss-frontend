'use client';

import { ChatTypingIndicator } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  CheckCircleIcon,
  Copy02Icon,
  ExternalLinkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback } from 'react';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { accessStateHint, checkResultTag, providerPresentation } from '../../utils/tenant-presentation';
import type { ConsentCheckResult, ConsentCheckState } from './use-tenant-consent';

export type ConsentMode = 'new' | 'reconnect' | 'details';

export interface ConsentPanelProps {
  provider: string;
  /** `null` = no link outstanding (never minted, expired, or consumed by a successful consent). */
  consentUrl: string | null | undefined;
  mode: ConsentMode;
  checkState: ConsentCheckState;
  checkResult: ConsentCheckResult | null;
  checkError: string | null;
  onCheck: () => void;
  /** New page only: unlock the domain field (the link becomes void). */
  onEditDomain?: () => void;
  disabled?: boolean;
}

const LINK_PLACEHOLDER: Record<ConsentMode, string> = {
  new: 'No consent link is available yet.',
  reconnect: 'No consent link is available yet.',
  // A connected-then-revoked tenant has no link outstanding: the one it had
  // was consumed by the consent that was later withdrawn. Reconnect mints one.
  details: 'No consent link is outstanding — use Reconnect to issue a new one.',
};

/**
 * The consent hand-off card the Figma frames draw (2097-122222 / 2097-119207 /
 * 2108-81037): the instruction for the customer's admin, the link in a
 * read-only field with copy + open inside it, and "Check Connection" with the
 * probe's verdict beside it — the read that proves the grant. Core `Input`,
 * `Button` and `Tag` only; the card owns nothing but which copy and which
 * state goes where.
 */
export function ConsentLinkPanel({
  provider,
  consentUrl,
  mode,
  checkState,
  checkResult,
  checkError,
  onCheck,
  onEditDomain,
  disabled = false,
}: ConsentPanelProps) {
  const { consentInstruction, reapproveInstruction, openLabel } = providerPresentation(provider);
  const sameWindow = useSameWindowLinks();
  const { copy } = useCopyToClipboard({ successDescription: 'Consent link copied to clipboard' });

  const url = consentUrl ?? null;
  const checking = checkState === 'checking';
  // Copy and open need a link; the probe does not — `checkDirectoryConnection`
  // always runs, and for a revoked tenant it is how the MSP learns whether the
  // admin has consented again.
  const inert = disabled || !url;

  const openLink = useCallback(() => {
    if (!url) return;
    // `target="_blank"` is dead in the app shells' web views; the same window is
    // the only way there, and the hook already says which case this is.
    if (sameWindow) {
      window.location.assign(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [sameWindow, url]);

  const resultTag = checkResult && !checking ? checkResultTag(checkResult) : null;

  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-label="Grant admin consent">
      {mode !== 'details' && (
        <div className="flex items-center justify-between gap-[var(--spacing-system-xs)]">
          <p className="text-ods-text-secondary text-h5">Grant admin consent</p>
          {onEditDomain && (
            <Button
              variant="link"
              size="compact"
              className="underline underline-offset-2"
              onClick={onEditDomain}
              disabled={disabled}
            >
              Edit Domain
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <p className="text-ods-text-primary text-h4">
          {mode === 'reconnect' ? reapproveInstruction : consentInstruction}
        </p>
        <Input
          readOnly
          value={url ?? ''}
          placeholder={LINK_PLACEHOLDER[mode]}
          aria-label="Consent link"
          // The frames set the URL a step below body scale; select-on-focus makes
          // the keyboard copy path (Tab, ⌘C) as short as the button.
          className="[&>input]:text-h6"
          onFocus={event => event.currentTarget.select()}
          endAdornment={
            <span className="flex items-center gap-[var(--spacing-system-xxs)]">
              <Button
                variant="transparent"
                size="icon-sm"
                aria-label="Copy consent link"
                onClick={() => url && copy(url)}
                disabled={inert}
              >
                <Copy02Icon />
              </Button>
              <Button variant="transparent" size="icon-sm" aria-label={openLabel} onClick={openLink} disabled={inert}>
                <ExternalLinkIcon />
              </Button>
            </span>
          }
        />
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)]">
          {/*
            The frames (2097-122247 → 122274) keep every control as it is while
            the probe runs and change only the slot beside the button: the three
            dots, then the verdict. The hook ignores a second click mid-probe, so
            the button stays live-looking without starting a second one.
          */}
          <Button variant="outline" onClick={onCheck} disabled={disabled} aria-busy={checking || undefined}>
            Check Connection
          </Button>
          {checking && (
            <span role="status" aria-label="Checking the connection" className="flex items-center">
              <ChatTypingIndicator size="sm" dotClassName="bg-ods-text-secondary" aria-hidden="true" />
            </span>
          )}
          {resultTag && (
            <Tag
              label={resultTag.label}
              variant={resultTag.variant}
              icon={checkState === 'connected' ? <CheckCircleIcon className="h-4 w-4" /> : undefined}
            />
          )}
        </div>
        {checkResult && checkState === 'failed' && (
          <p className="text-ods-text-secondary text-h6" role="status">
            {accessStateHint(checkResult.state)}
          </p>
        )}
        {checkError && checkState === 'failed' && (
          <p className="text-ods-error text-h6" role="status">
            {checkError}
          </p>
        )}
      </div>
    </section>
  );
}
