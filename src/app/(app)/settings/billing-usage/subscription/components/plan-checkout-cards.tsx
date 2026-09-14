'use client';

import type { PlanCheckout } from '../hooks/use-plan-checkout';
import { AiAssistantsIncludedNote } from './ai-assistants-included-note';
import { AiTokenBalanceCard } from './ai-token-balance-card';
import { DeviceManagementCard } from './device-management-card';

/**
 * The form's body: the note, then the device card beside the AI card.
 *
 * The lock screen and the Activate Subscription modal draw exactly this and
 * differ only in the frame around it and where the total and the button go
 * (see `usePlanCheckout`). A fragment, so each frame spaces it as its own
 * children.
 */
export function PlanCheckoutCards({ form }: { form: PlanCheckout }) {
  return (
    <>
      {form.showAiCard && <AiAssistantsIncludedNote />}

      {/* `items-stretch`, not `items-start`: side by side, two cards of
          different heights read as one unfinished. Each card keeps its content
          top-aligned (they are `flex-col`), so the shorter one gains empty space
          at the bottom rather than stretched rows. */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {form.showDeviceCard && (
          <DeviceManagementCard
            productRef={form.deviceProduct}
            subscriptionProductRef={form.deviceSubscriptionProduct}
            deviceCount={form.deviceCount}
            onUpdatesChange={form.setDeviceUpdates}
          />
        )}
        {form.showAiCard && (
          <AiTokenBalanceCard loading={form.loading} deviceMode={form.deviceUpdates?.mode ?? null} topUp={form.topUp} />
        )}
      </div>
    </>
  );
}
