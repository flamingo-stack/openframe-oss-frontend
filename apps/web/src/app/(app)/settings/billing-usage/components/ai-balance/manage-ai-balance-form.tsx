'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, ModalV2Content, ModalV2Footer } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { formatWholeCurrency } from '@/lib/format-currency';
import { formatDateTime } from '@/lib/format-date';
import { AI_BALANCE_EXPLANATION, AiTopUpFields } from './ai-top-up-fields';
import { AutoTopUpCheckbox } from './auto-top-up-checkbox';
import {
  type AutoTopUpSettingsField,
  type AutoTopUpSettingsValues,
  initialAutoTopUpSettingsValues,
  validateAutoTopUpSettings,
} from './auto-top-up-settings';
import { AutoTopUpSettingsFields } from './auto-top-up-settings-fields';
import { AutoTopUpSetupNotice } from './auto-top-up-setup-notice';
import { type AutoTopUpStatus, FALLBACK_MIN_TOP_UP_USD } from './auto-top-up-status';
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
 * The box changes what the modal asks and what the button sends:
 *  - ticked: the arrangement's three figures (threshold, amount, spend limit),
 *    and the button saves them;
 *  - unticked, and it was on: switch the arrangement off (the figures say
 *    nothing about that, so they step aside);
 *  - unticked, and it was off: the amount tiles, and the button buys one once.
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

const CHECKED_DESCRIPTION = 'Automatically refill your balance when it drops below the threshold.';

const NO_SETTINGS: AutoTopUpSettingsValues = { thresholdUsd: '', amountUsd: '', spendLimitUsd: '' };

/**
 * The button is never locked over the figures. Pressed with something missing
 * or out of range, it says so under the field (`validateAutoTopUpSettings`,
 * `AiTopUp.validate`) — a disabled button explains nothing, and the user is
 * left guessing what to fix.
 */
export function ManageAiBalanceForm({ data, onClose }: ManageAiBalanceFormProps) {
  const { toast } = useToast();
  const settings = data?.settings ?? null;
  const wasEnabled = settings?.enabled ?? false;
  // Only the wait has no settings, and nothing is validated then.
  const minimums = settings ?? { minimumAmountUsd: FALLBACK_MIN_TOP_UP_USD, minimumThresholdUsd: 0 };
  // A one-time purchase starts from nothing chosen.
  const topUp = useAiTopUp({ tokenPrice: data?.tokenPrice ?? null, minimumUsd: minimums.minimumAmountUsd });
  const [autoTopUp, setAutoTopUp] = useState(wasEnabled);
  // The arrangement's figures start from what is saved: the backend keeps them
  // while it is off, so ticking the box again restores them. Unmounted while the
  // modal is closed, so this reads the answer it opened on.
  const [values, setValues] = useState<AutoTopUpSettingsValues>(() =>
    settings ? initialAutoTopUpSettingsValues(settings) : NO_SETTINGS,
  );
  // Set by the first save and kept: from then on the fields answer every edit at once.
  const [attempted, setAttempted] = useState(false);
  const purchase = usePurchaseTokens();
  const update = useUpdateAutoTopUp();

  const loading = data == null;
  const pending = purchase.isPending || update.isPending;
  const intent: Intent = autoTopUp ? 'enable' : wasEnabled ? 'disable' : 'purchase';
  const validation = validateAutoTopUpSettings(values, minimums);
  const settingsErrors = attempted && !validation.ok ? validation.errors : {};

  const setField = (field: AutoTopUpSettingsField, next: string) =>
    setValues(current => ({ ...current, [field]: next }));

  const handleSubmit = () => {
    if (intent === 'disable') {
      update.mutate(
        // The limit goes back as it is: a save without one removes it, and the
        // backend keeps it for the day auto top-up is turned back on.
        { enabled: false, spendLimitUsd: settings?.spendLimitUsd ?? null },
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

    if (intent === 'purchase') {
      if (topUp.validate() != null || topUp.amountUsd == null) return;
      purchase.mutate(topUp.amountUsd, { onSuccess: onClose });
      return;
    }

    setAttempted(true);
    if (!validation.ok) return;
    const { input } = validation;

    update.mutate(
      { enabled: true, ...input },
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
            description: `Your balance refills with ${formatWholeCurrency(input.amountUsd)} whenever it drops below ${formatWholeCurrency(input.thresholdUsd)}.`,
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
          description={autoTopUp ? CHECKED_DESCRIPTION : undefined}
        />
        {autoTopUp && settings?.paymentMethodSetupUrl && (
          <AutoTopUpSetupNotice setupUrl={settings.paymentMethodSetupUrl} />
        )}
        {autoTopUp && settings?.paused && <SpendLimitReachedAlert resumesAt={settings.resumesAt} />}
        {intent === 'enable' && (
          <AutoTopUpSettingsFields
            values={values}
            onChange={setField}
            errors={settingsErrors}
            tokenPrice={data?.tokenPrice ?? null}
            spentUsd={settings?.spentUsd ?? null}
            disabled={loading || pending}
          />
        )}
        {intent === 'purchase' && (
          <AiTopUpFields topUp={topUp} label="One-Time Top Up" disabled={loading || pending} loading={loading} />
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

/** The spend limit holds refills back. A save lifts the pause, so raising the limit here resumes them at once. */
function SpendLimitReachedAlert({ resumesAt }: { resumesAt: AutoTopUpStatus['resumesAt'] }) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
      <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <p className="font-bold text-ods-text-primary text-h3">Spend limit reached</p>
        <p className="text-ods-text-secondary text-h6">
          {resumesAt ? `Auto top-ups are paused until ${formatDateTime(resumesAt)}.` : 'Auto top-ups are paused.'} Raise
          the limit to resume them sooner.
        </p>
      </div>
    </div>
  );
}
