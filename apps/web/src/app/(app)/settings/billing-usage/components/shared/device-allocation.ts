import { graphql, readInlineData } from 'react-relay';
import type { deviceAllocation_subscription$key } from '@/__generated__/deviceAllocation_subscription.graphql';
import { OpenframeProduct } from '@/generated/schema-enums';
import { activePackage } from './active-package';

/**
 * The fleet against the device package: how many devices are under management,
 * what this period's allowance is, and what is billed as overage.
 *
 * Read by the Device Usage card, by the overage block under it and by the
 * payment-free Usage page — the same numbers, so one reader keeps "37/25" on the
 * card and "36 Devices" below it from ever disagreeing. Nothing priced is
 * selected here, which is what lets the Usage page spread it.
 *
 * Every figure is the backend's: after an in-period upgrade the bill is not
 * "used minus the package" (the overage frozen at the upgrade stays billed, the
 * allowance is only the part of the upgrade that was paid for).
 */
const deviceAllocationFragment = graphql`
  fragment deviceAllocation_subscription on SubscriptionDetail @inline {
    usage {
      devicesUsed
      devicesUsedAgainstLimit
      devicesCommittedOverage
      devicesLimit
      devicesOverage
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
  /** Devices counted against this period's allowance: `used` less the overage frozen at an upgrade. */
  usedAgainstLimit: number;
  /** This period's device allowance; 0 without a package. */
  allocation: number;
  /** Devices frozen as overage at in-period package upgrades; 0 without one. */
  committedOverage: number;
  /** Devices billed as overage this period, the frozen ones included. */
  overage: number;
  /**
   * The one state on this page worth interrupting for: a committed package and
   * devices billed as overage this period.
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
  const overage = usage?.devicesOverage ?? 0;

  return {
    used: usage?.devicesUsed ?? 0,
    usedAgainstLimit: usage?.devicesUsedAgainstLimit ?? 0,
    allocation: usage?.devicesLimit ?? 0,
    committedOverage: usage?.devicesCommittedOverage ?? 0,
    overage,
    overLimit: !isPayg && overage > 0,
    isPayg,
  };
}
