'use client';

import { CommandBox } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { mailboxProviderPresentation } from '../../utils/mailbox-presentation';

interface ForwardingCardProps {
  supportAddress: string;
  provider: string;
  inboundAddress: string;
}

/**
 * SET UP FORWARDING (Figma 4527-132336): the address this mailbox forwards to, made for it alone, and the provider's
 * steps to set the forwarding up, and the provider's own help page on it.
 *
 * Not drawn yet, waiting on the backend: Send Test Email and its result (`runForwardingTest` answers NOT_IMPLEMENTED
 * until CU-17tkuw66n94).
 */
export function ForwardingCard({ supportAddress, provider, inboundAddress }: ForwardingCardProps) {
  const { copy } = useCopyToClipboard({ successDescription: 'Forwarding address copied' });
  const { forwardingSteps, guideUrl } = mailboxProviderPresentation(provider);
  const sameWindow = useSameWindowLinks();
  // An off-origin same-window navigation would strand the desktop app on the provider's page, while its shell hands
  // `target="_blank"` to the system browser (see `download-apps-view`).
  const newTab = useIsDesktopShell() || !sameWindow;
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xs)]">
      <h3 className="text-ods-text-secondary text-h5">Set up forwarding</h3>
      <div className="flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <p className="text-ods-text-primary text-h4">
          Forward {supportAddress} to this address. It was made for this mailbox only.
        </p>
        <CommandBox
          command={inboundAddress}
          onCopy={() => copy(inboundAddress)}
          copyAriaLabel="Copy forwarding address"
          maxLines={1}
        />
        <ol className="flex list-decimal flex-col gap-[var(--spacing-system-xxs)] pl-[var(--spacing-system-l)] text-ods-text-primary text-h6">
          {forwardingSteps.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {guideUrl && (
          <Button
            variant="link"
            size="compact"
            className="self-start underline underline-offset-2"
            href={guideUrl}
            openInNewTab={newTab}
            rightIcon={<ExternalLinkIcon size={16} className="text-ods-text-secondary" />}
          >
            Detailed Instruction
          </Button>
        )}
      </div>
    </section>
  );
}
