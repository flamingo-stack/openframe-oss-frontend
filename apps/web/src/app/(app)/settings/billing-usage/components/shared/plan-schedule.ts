import { graphql, readInlineData } from 'react-relay';
import type {
  planSchedule_subscription$data,
  planSchedule_subscription$key,
} from '@/__generated__/planSchedule_subscription.graphql';
import { OpenframeProduct, SubscriptionProductStatus, SubscriptionStatus } from '@/generated/schema-enums';

/**
 * The device package in force, the one scheduled to take over, and the dates
 * between them — what the Current Plan and Updated Plan blocks are built from.
 * One reader, because the two blocks sit side by side and the left column's
 * "ends on" has to be the right column's "starts on".
 */
const planScheduleFragment = graphql`
  fragment planSchedule_subscription on SubscriptionDetail @inline {
    status
    products {
      name
      packageOptions {
        id
        billingPeriod
        # Empty on a committed option, which is why the rate is read from the
        # catalog (see catalog-device-rate.ts). Kept because a negotiated rate,
        # if one is ever stated here, is what this tenant actually pays and
        # must win.
        price
        status
        startDate
        endDate
      }
      payAsYouGoOption {
        id
        price
      }
    }
  }
`;

type SubscriptionOption = planSchedule_subscription$data['products'][number]['packageOptions'][number];

export interface DevicePackage {
  billingPeriod: string | null;
  /** The subscription's own rate per device per month, when it states one. */
  price: number | null;
  startsOn: string | null;
  endsOn: string | null;
}

export interface PlanSchedule {
  isTrial: boolean;
  isPendingCancellation: boolean;
  /** The committed device package in force. */
  active: DevicePackage | null;
  /** A scheduled downgrade surfaces as a PENDING_ACTIVATION option. */
  pending: DevicePackage | null;
  /** $ per device per month on the metered option, as the subscription states it. */
  paygPrice: number | null;
  /** Metered billing, nothing committed. */
  deviceIsPayg: boolean;
  /**
   * When the CURRENT package stops — whether a scheduled one takes over or
   * billing simply reverts to metered.
   *
   * This is the ONLY signal that a plan change is coming, and it has to be,
   * because the obvious one is not always there: downgrading to pay-as-you-go
   * schedules no replacement package (pay-as-you-go is not a package), so
   * `pending` stays empty and only this date appears. A cancellation is
   * excluded: that has its own field, and the two would print the same day
   * twice.
   */
  currentPlanEndsOn: string | null;
  hasScheduledPackage: boolean;
  /** Nothing takes over: the commitment lapses and billing reverts to metered. */
  revertsToPayg: boolean;
  hasPendingPlan: boolean;
  /** The plan carries the AI product, so its grant is worth a row. */
  carriesAi: boolean;
}

function toPackage(option: SubscriptionOption): DevicePackage {
  return {
    billingPeriod: option.billingPeriod ?? null,
    price: option.price ?? null,
    startsOn: (option.startDate ?? null) as string | null,
    endsOn: (option.endDate ?? null) as string | null,
  };
}

export function planSchedule(ref: planSchedule_subscription$key): PlanSchedule {
  const { status, products } = readInlineData(planScheduleFragment, ref);
  const devices = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const activeOption = devices?.packageOptions.find(o => o.status === SubscriptionProductStatus.ACTIVE) ?? null;
  const pendingOption =
    devices?.packageOptions.find(o => o.status === SubscriptionProductStatus.PENDING_ACTIVATION) ?? null;

  const active = activeOption ? toPackage(activeOption) : null;
  const pending = pendingOption ? toPackage(pendingOption) : null;
  const isPendingCancellation = status === SubscriptionStatus.PENDING_CANCELLATION;
  const hasScheduledPackage = pending != null;
  // Set when the commitment is genuinely ending, not renewing (the backend
  // writes `endDate = phaseStart - 1` when a change is scheduled).
  const planEnds = active?.endsOn != null && !isPendingCancellation;
  const revertsToPayg = planEnds && !hasScheduledPackage;

  return {
    isTrial: status === SubscriptionStatus.TRIAL,
    isPendingCancellation,
    active,
    pending,
    paygPrice: devices?.payAsYouGoOption?.price ?? null,
    deviceIsPayg: devices?.payAsYouGoOption != null && active == null,
    currentPlanEndsOn: planEnds && active ? active.endsOn : null,
    hasScheduledPackage,
    revertsToPayg,
    hasPendingPlan: hasScheduledPackage || revertsToPayg,
    carriesAi: products.some(p => p.name === OpenframeProduct.AI_ASSISTANCE),
  };
}
