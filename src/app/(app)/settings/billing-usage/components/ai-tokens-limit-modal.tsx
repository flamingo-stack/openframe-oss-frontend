'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useAiSpendLimit } from '../hooks/use-ai-spend-limit';
import { useUpdateAiSpendCap } from '../hooks/use-update-ai-spend-cap';
import { AI_LIMIT_EXPLANATION, AiSpendLimitFields } from './ai-spend-limit-fields';

interface AiTokensLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** $ per token from the AI product's metered option. `null` locks the fields. */
  tokenPrice: number | null;
  /** The cap stored on the subscription, in USD. `null` = uncapped. */
  capUsd: number | null;
}

/**
 * Setting the ceiling on a month's AI spend, from the billing page.
 *
 * Unlike the paywall's AI card — which writes every choice as it is made,
 * because the user is mid-purchase and may never press anything else — this
 * saves once, on its own button. The cap is a live setting on a live
 * subscription here, and opening the dialog to look at it must not be able to
 * change it.
 *
 * The mutation answers with the subscription's `id` and new `aiSpendCapUsd`, so
 * Relay normalises the value into the record the page reads. Nothing refetches.
 */
export function AiTokensLimitModal({ isOpen, onClose, tokenPrice, capUsd }: AiTokensLimitModalProps) {
  // Unmounted while closed, so every opening starts from what is stored rather
  // than from the edits of a dialog that was dismissed.
  if (!isOpen) return null;

  return <AiTokensLimitModalBody onClose={onClose} tokenPrice={tokenPrice} capUsd={capUsd} />;
}

function AiTokensLimitModalBody({ onClose, tokenPrice, capUsd }: Omit<AiTokensLimitModalProps, 'isOpen'>) {
  const limit = useAiSpendLimit({ capUsd, tokenPrice });
  const updateCap = useUpdateAiSpendCap();

  const handleSave = () => {
    if (!limit.isComplete) return;
    updateCap.mutate(limit.capUsd, { onSuccess: onClose });
  };

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title="AI Tokens Limit"
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
            onClick={handleSave}
            loading={updateCap.isPending}
            disabled={updateCap.isPending || !limit.isComplete}
          >
            Save Tokens Limit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <p className="text-h4 text-ods-text-primary">{AI_LIMIT_EXPLANATION}</p>
        {/* Only the save gates the fields: the amounts disable themselves when
            the metered rate is missing, so switching the limit off stays
            possible even then. */}
        <AiSpendLimitFields limit={limit} disabled={updateCap.isPending} />
      </div>
    </SimpleModal>
  );
}
