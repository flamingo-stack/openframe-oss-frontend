import { graphql, readInlineData } from 'react-relay';
import type { catalogDeviceRate_product$key } from '@/__generated__/catalogDeviceRate_product.graphql';
import { OpenframeProduct } from '@/generated/schema-enums';

/**
 * What one device costs per month on a billing period, per the CATALOG.
 *
 * A committed option on the subscription leaves its own price empty, so the
 * plan rows read the rate from here — the same figure, read the same way, that
 * the plan picker prices its panels from. An option states its rate as a flat
 * price or as a price band, and which one is filled depends on the option; the
 * entry band IS the period's rate, because devices are priced by period and
 * not by quantity (see `use-device-plan-selection.ts`).
 *
 * `@inline`, because the readers are the two plan sections' rate lookups —
 * plain functions, not components of their own.
 */
const catalogDeviceRateFragment = graphql`
  fragment catalogDeviceRate_product on Product @inline {
    name
    packageOptions {
      id
      billingPeriod
      price
      priceTiers {
        unitPrice
      }
    }
    payAsYouGoOption {
      id
      price
      priceTiers {
        unitPrice
      }
    }
  }
`;

/**
 * The catalog's monthly rate per device for `period`, or for the metered option
 * when `period` is `null`. `null` when the catalog has no such option.
 */
export function catalogDeviceRate(
  products: readonly catalogDeviceRate_product$key[],
  period: string | null,
): number | null {
  const product = products
    .map(ref => readInlineData(catalogDeviceRateFragment, ref))
    .find(p => p.name === OpenframeProduct.MANAGED_DEVICES);
  if (!product) return null;

  const option =
    period == null ? product.payAsYouGoOption : product.packageOptions.find(o => o.billingPeriod === period);
  return option?.price ?? option?.priceTiers?.[0]?.unitPrice ?? null;
}
