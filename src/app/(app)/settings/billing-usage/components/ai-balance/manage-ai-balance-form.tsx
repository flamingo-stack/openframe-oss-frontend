'use client';

import { Button, ModalV2Content, ModalV2Footer } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { formatWholeCurrency } from '@/lib/format-currency';
import { AI_BALANCE_EXPLANATION, AiTopUpFields } from './ai-top-up-fields';
import { AutoTopUpCheckbox } from './auto-top-up-checkbox';
import { AutoTopUpSetupNotice } from './auto-top-up-setup-notice';
import { type AutoTopUpStatus, autoTopUpThresholdUsd } from './auto-top-up-status';
import { useAiTopUp } from './use-ai-top-up';
import { usePurchaseTokens } from './use-purchase-tokens';
import { useUpdateAutoTopUp } from './use-update-auto-top-up';

export interface ManageAiBalanceFormData {
  settings: AutoTopUpStatus;
  /** $ per token from the AI product's metered option; `null` when the rate is unknown. */
  tokenPrice: number | null;
}

interface ManageAiBalanceFormProps {
  /** `null` while the arrangement is on its way: the real controls, locked. */
  data: ManageAiBalanceFormData | null;
  onClose: () => void;
}

/**
 * What the one button does, decided by the checkbox against what is saved.
 *
 * The mockup draws one set of amounts and relabels them when the box is
 * ticked: a one-time purchase, or the refill amount. So the box does not act
 * on its own — it changes what the amounts mean and what the button sends:
 *  - ticked: save the arrangement with the chosen amount;
 *  - unticked, and it was on: switch the arrangement off (the amounts say
 *    nothing about that, so they step aside);
 *  - unticked, and it was off: buy the chosen amount once.
 */
type Intent = 'enable' | 'disable' | 'purchase';

const SUBMIT_LABEL: Record<Intent, string> = {
  enable: 'Save',
  disable: 'Turn Off Auto Top-up',
  // The purchase raises an invoice rather than charging on the spot, so the
  // button says so rather than the mockup's "Save": nothing is saved here, and
  // the tokens land once the invoice is paid.
  purchase: 'Proceed to Payment',
};

const PAYMENT_FAILED_MESSAGE =
  'Switched off after a declined charge. Update your card in the Customer Portal, then turn it back on.';

/**
 * The button is never locked over the amount. Pressed with nothing chosen or a
 * figure under the floor, it says so under the fields (`AiTopUp.validate`) — a
 * disabled button explains nothing, and the user is left guessing what to fix.
 */
export function ManageAiBalanceForm({ data, onClose }: ManageAiBalanceFormProps) {
  const { toast } = useToast();
  const settings = data?.settings ?? null;
  const wasEnabled = settings?.enabled ?? false;
  // A refill amount already saved is where the tiles start; a one-time purchase
  // starts from nothing chosen.
  const topUp = useAiTopUp({ tokenPrice: data?.tokenPrice ?? null, initial: wasEnabled ? settings?.amountUsd : null });
  const [autoTopUp, setAutoTopUp] = useState(wasEnabled);
  const purchase = usePurchaseTokens();
  const update = useUpdateAutoTopUp();

  const loading = data == null;
  const pending = purchase.isPending || update.isPending;
  const intent: Intent = autoTopUp ? 'enable' : wasEnabled ? 'disable' : 'purchase';

  const handleSubmit = () => {
    if (intent === 'disable') {
      update.mutate(
        { enabled: false },
        {
          onCompleted: () => {
            toast({
              title: 'Auto Top-up Off',
              description: 'Your balance will no longer refill itself.',
              variant: 'success',
            });
            onClose();
          },
        },
      );
      return;
    }

    if (topUp.validate() != null || topUp.amountUsd == null) return;
    const { amountUsd } = topUp;

    if (intent === 'purchase') {
      purchase.mutate(amountUsd, { onSuccess: onClose });
      return;
    }

    update.mutate(
      { enabled: true, amountUsd, thresholdUsd: autoTopUpThresholdUsd(amountUsd) },
      {
        onCompleted: saved => {
          // Refused for want of a card: the modal stays open, and the notice
          // under the box (read from the store the answer just updated) says
          // where to add one.
          if (saved.paymentMethodSetupUrl) {
            toast({
              title: 'Add a Payment Method',
              description: 'Auto top-up needs a card on file. Add one, then save again.',
              variant: 'warning',
            });
            return;
          }
          toast({
            title: 'Auto Top-up Saved',
            description: `Your balance refills with ${formatWholeCurrency(amountUsd)} whenever it runs low.`,
            variant: 'success',
          });
          onClose();
        },
      },
    );
  };

  return (
    <>
      <ModalV2Content className="flex flex-col gap-[var(--spacing-system-l)]">
        <p className="text-ods-text-primary text-h4">{AI_BALANCE_EXPLANATION}</p>
        <AutoTopUpCheckbox
          checked={autoTopUp}
          onCheckedChange={setAutoTopUp}
          disabled={loading || pending}
          error={settings?.paymentFailed && !autoTopUp ? PAYMENT_FAILED_MESSAGE : undefined}
        />
        {autoTopUp && settings?.paymentMethodSetupUrl && (
          <AutoTopUpSetupNotice setupUrl={settings.paymentMethodSetupUrl} />
        )}
        {intent !== 'disable' && (
          <AiTopUpFields
            topUp={topUp}
            label={autoTopUp ? 'Auto Top Up Amount' : 'One-Time Top Up'}
            disabled={loading || pending}
          />
        )}
      </ModalV2Content>
      <ModalV2Footer>
        {/* Figma splits the footer into two halves and leaves the left one
            empty, so the button fills the right half rather than hugging its
            label. `ModalV2Footer` is a bare `flex`, so the spacer is ours. */}
        <div className="flex-1" />
        <Button
          variant="accent"
          className="flex-1"
          onClick={handleSubmit}
          loading={pending}
          disabled={loading || pending}
        >
          {SUBMIT_LABEL[intent]}
        </Button>
      </ModalV2Footer>
    </>
  );
}
