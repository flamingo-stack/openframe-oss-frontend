/**
 * The device figures the card, the overage block and the Usage page share. They
 * are the backend's (CU-17tkuw602a1): after an in-period package upgrade the
 * bill is not "used minus the package", so nothing here may re-derive it.
 */
import { describe, expect, it, vi } from 'vitest';
import type { deviceAllocation_subscription$key } from '@/__generated__/deviceAllocation_subscription.graphql';
import { deviceAllocation } from './device-allocation';

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of;
// an @inline read hands back the record it was given.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));

interface Usage {
  devicesUsed: number;
  devicesUsedAgainstLimit: number;
  devicesCommittedOverage: number;
  devicesLimit: number;
  devicesOverage: number;
}

function subscription(usage: Usage, packageQuantity: number | null): deviceAllocation_subscription$key {
  return {
    usage,
    products: [
      {
        name: 'MANAGED_DEVICES',
        payAsYouGoOption: { id: 'payg' },
        packageOptions:
          packageQuantity == null
            ? []
            : [{ id: 'p', packageOptionId: 'yearly', quantity: packageQuantity, status: 'ACTIVE' }],
      },
    ],
  } as unknown as deviceAllocation_subscription$key;
}

describe('deviceAllocation', () => {
  it('after an in-period upgrade: the overage is the billed one, not used minus the new package', () => {
    // QA: 20 devices, 49 used, upgraded to 40 → 29 billed (not 49/40, 9 Devices).
    const device = deviceAllocation(
      subscription(
        {
          devicesUsed: 49,
          devicesUsedAgainstLimit: 20,
          devicesCommittedOverage: 29,
          devicesLimit: 20,
          devicesOverage: 29,
        },
        40,
      ),
    );

    expect(device).toEqual({
      used: 49,
      usedAgainstLimit: 20,
      allocation: 20,
      committedOverage: 29,
      overage: 29,
      overLimit: true,
      isPayg: false,
    });
  });

  it('the ticket example adds up: 61 used = 24 frozen + 37 against a limit of 25, 36 billed', () => {
    const device = deviceAllocation(
      subscription(
        {
          devicesUsed: 61,
          devicesUsedAgainstLimit: 37,
          devicesCommittedOverage: 24,
          devicesLimit: 25,
          devicesOverage: 36,
        },
        35,
      ),
    );

    expect(device.committedOverage + device.usedAgainstLimit).toBe(device.used);
    expect(device.overage).toBe(36);
    expect(device.overage - device.committedOverage).toBe(device.usedAgainstLimit - device.allocation);
  });

  it('no upgrade this period: the package is the limit and nothing over it is not over the limit', () => {
    const device = deviceAllocation(
      subscription(
        { devicesUsed: 8, devicesUsedAgainstLimit: 8, devicesCommittedOverage: 0, devicesLimit: 10, devicesOverage: 0 },
        10,
      ),
    );

    expect(device).toMatchObject({ usedAgainstLimit: 8, allocation: 10, overage: 0, overLimit: false });
  });

  it('pay-as-you-go is never over a limit, whatever is metered', () => {
    const device = deviceAllocation(
      subscription(
        { devicesUsed: 8, devicesUsedAgainstLimit: 8, devicesCommittedOverage: 0, devicesLimit: 0, devicesOverage: 8 },
        null,
      ),
    );

    expect(device).toMatchObject({ isPayg: true, overLimit: false, allocation: 0 });
  });
});
