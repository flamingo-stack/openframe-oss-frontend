'use client';

import { Button, CheckboxBlock, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useId } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useAiTopUp } from '../hooks/use-ai-top-up';
import { usePurchaseTokens } from '../hooks/use-purchase-tokens';
import { AUTO_TOP_UP, AUTO_TOP_UP_DESCRIPTION } from '../lib/auto-top-up';
import { AI_BALANCE_EXPLANATION, AiTopUpFields } from './ai-top-up-fields';

interface ManageAiBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** $ per token from the AI product's metered option. `null` until it loads. */
  tokenPrice: number | null;
}

/**
 * Buying AI tokens from the billing page.
 *
 * The mockup's "Enable Auto Top-up" — refill the balance with the chosen amount
 * whenever it runs out — is drawn but locked: the API has nothing to store that
 * choice in yet (see `auto-top-up.ts`), so the checkbox stays off and says so,
 * and the amounts below it are a one-time purchase. Once it can be switched on,
 * the same amounts become the refill amount, as the mockup relabels them.
 *
 * The purchase raises an invoice rather than charging on the spot, so the
 * button reads "Proceed to Payment" rather than the mockup's "Save": nothing is
 * saved here, and the tokens land once the invoice is paid.
 */
export function ManageAiBalanceModal({ isOpen, onClose, tokenPrice }: ManageAiBalanceModalProps) {
  // Unmounted while closed, so every opening starts from nothing chosen rather
  // than from the edits of a dialog that was dismissed.
  if (!isOpen) return null;

  return <ManageAiBalanceModalBody onClose={onClose} tokenPrice={tokenPrice} />;
}

function ManageAiBalanceModalBody({ onClose, tokenPrice }: Omit<ManageAiBalanceModalProps, 'isOpen'>) {
  const topUp = useAiTopUp({ tokenPrice });
  const purchase = usePurchaseTokens();
  const autoTopUpId = useId();

  const handleSubmit = () => {
    if (topUp.amountUsd == null) return;
    purchase.mutate(topUp.amountUsd, { onSuccess: onClose });
  };

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title="Manage AI Balance"
      className="md:max-w-[600px]"
      footer={
        <>
          {/* Figma splits the footer into two halves and leaves the left one
              empty, so the button fills the right half rather than hugging its
              label. `ModalV2Footer` is a bare `flex`, so the spacer is ours. */}
          <div className="flex-1" />
          <Button
            variant="accent"
            className="flex-1"
            onClick={handleSubmit}
            loading={purchase.isPending}
            disabled={purchase.isPending || !topUp.isComplete}
          >
            Proceed to Payment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <p className="text-ods-text-primary text-h4">{AI_BALANCE_EXPLANATION}</p>
        {/* Controlled and never toggled: the value is the backend's answer, and
            today the backend has none. The tag says why the box will not tick,
            so a locked control does not read as a broken one. */}
        <CheckboxBlock
          id={autoTopUpId}
          label="Enable Auto Top-up"
          description={AUTO_TOP_UP_DESCRIPTION}
          checked={AUTO_TOP_UP.enabled}
          disabled={!AUTO_TOP_UP.available || purchase.isPending}
          trailing={!AUTO_TOP_UP.available && <Tag as="span" variant="grey" label="Coming soon" />}
        />
        <AiTopUpFields
          topUp={topUp}
          label={AUTO_TOP_UP.enabled ? 'Auto Top Up Amount' : 'One-time top up'}
          disabled={purchase.isPending}
        />
      </div>
    </SimpleModal>
  );
}
