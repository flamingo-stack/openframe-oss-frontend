import { graphql, readInlineData } from 'react-relay';
import type { deviceAllocation_subscription$key } from '@/__generated__/deviceAllocation_subscription.graphql';
import { OpenframeProduct } from '@/generated/schema-enums';
import { activePackage } from './active-package';

/**
 * The fleet against the device package: how many devices are under management,
 * how many the committed package covers, and whether the count has passed it.
 *
 * Read by the Device Usage card, by the overage block under it and by the
 * payment-free Usage page — the same three numbers, so one reader keeps
 * "247/300" on the card and "You're over" below it from ever disagreeing.
 * Nothing priced is selected here, which is what lets the Usage page spread it.
 */
const deviceAllocationFragment = graphql`
  fragment deviceAllocation_subscription on SubscriptionDetail @inline {
    usage {
      devicesUsed
    }
    products {
      name
      payAsYouGoOption {
        id
      }
      ...activePackage_subscriptionProduct
    }
  }
`;

export interface DeviceAllocation {
  /** Devices under management. */
  used: number;
  /** Devices the committed package covers; 0 without one. */
  allocation: number;
  /** Devices past the package. */
  overage: number;
  /**
   * The one state on this page worth interrupting for: a committed package with
   * more devices under management than it covers.
   *
   * There used to be a second, "approaching" tier at 90% of the allocation.
   * Being near a device limit costs nothing — the bill only changes once it is
   * passed, which is what this says. A banner that fires before anything has
   * happened is one users learn to scroll past.
   */
  overLimit: boolean;
  /** Metered billing, nothing committed. */
  isPayg: boolean;
}

export function deviceAllocation(ref: deviceAllocation_subscription$key): DeviceAllocation {
  const { usage, products } = readInlineData(deviceAllocationFragment, ref);
  const devices = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const active = devices ? activePackage(devices) : null;
  const isPayg = devices?.payAsYouGoOption != null && active == null;

  const used = usage?.devicesUsed ?? 0;
  const allocation = active?.quantity ?? 0;
  const overage = Math.max(0, used - allocation);

  return { used, allocation, overage, overLimit: !isPayg && allocation > 0 && overage > 0, isPayg };
}
