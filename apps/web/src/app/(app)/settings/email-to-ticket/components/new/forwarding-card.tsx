'use client';

import { CommandBox } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { forwardingCard_mailbox$key } from '@/__generated__/forwardingCard_mailbox.graphql';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import { mailboxProviderPresentation } from '../../utils/mailbox-presentation';
import { ForwardingTest } from '../forwarding/forwarding-test';

const forwardingCardFragment = graphql`
  fragment forwardingCard_mailbox on Mailbox {
    supportAddress
    provider
    inboundAddress
    ...forwardingTest_mailbox
  }
`;

/**
 * SET UP FORWARDING (Figma 4527-132336): the address this mailbox forwards to, made for it alone, the provider's steps
 * to set the forwarding up and its own help page on it, and the test that proves the forwarding works.
 */
export function ForwardingCard({
  mailbox,
  disabled = false,
}: {
  mailbox: forwardingCard_mailbox$key;
  disabled?: boolean;
}) {
  const data = useFragment(forwardingCardFragment, mailbox);
  const { supportAddress, provider, inboundAddress } = data;
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
        <ForwardingTest mailbox={data} disabled={disabled} />
      </div>
    </section>
  );
}
