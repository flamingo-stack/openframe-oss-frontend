'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ModalV2Content } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { manageAiBalanceModalQuery as ManageAiBalanceModalQueryType } from '@/__generated__/manageAiBalanceModalQuery.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { OpenframeProduct } from '@/generated/schema-enums';
import { aiTokenPrice } from '../shared/ai-token-price';
import { toAutoTopUpStatus } from './auto-top-up-status';
import { ManageAiBalanceForm } from './manage-ai-balance-form';

/**
 * The arrangement as it stands, and the rate that prices the tiles (what $20
 * buys) — read from both the catalog and the subscription's own record of the
 * AI product, for the reason `aiTokenPrice` gives.
 */
const manageAiBalanceModalQuery = graphql`
  query manageAiBalanceModalQuery {
    autoTopUpSettings {
      ...autoTopUpStatus_settings
    }
    billingPlan {
      id
      products {
        id
        name
        ...aiTokenPrice_product
      }
    }
    subscription {
      id
      products {
        name
        ...aiTokenPrice_subscriptionProduct
      }
    }
  }
`;

interface ManageAiBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Buying AI tokens from the billing page, or arranging for the balance to buy
 * them itself.
 *
 * Over its own query, run only once the modal opens — and answered from the
 * store when the page has already read the arrangement for its card. Unmounted
 * while closed, so every opening starts from what is saved rather than from
 * the edits of a dialog that was dismissed.
 */
export function ManageAiBalanceModal({ isOpen, onClose }: ManageAiBalanceModalProps) {
  if (!isOpen) return null;

  return (
    <SimpleModal isOpen onClose={onClose} title="Manage AI Balance" className="md:max-w-[600px]">
      {/* A failed read stays inside the modal: the page behind it is fine. */}
      <ErrorBoundary
        fallback={
          <ModalV2Content className="flex flex-col gap-[var(--spacing-system-xs)]">
            <p className="font-bold text-ods-text-primary text-h3">We couldn't load your AI balance settings.</p>
            <p className="text-ods-text-secondary text-h4">
              Something went wrong on our side. Try again in a moment, or contact support if it keeps happening.
            </p>
          </ModalV2Content>
        }
      >
        <Suspense fallback={<ManageAiBalanceForm data={null} onClose={onClose} />}>
          <ManageAiBalanceContent onClose={onClose} />
        </Suspense>
      </ErrorBoundary>
    </SimpleModal>
  );
}

function ManageAiBalanceContent({ onClose }: { onClose: () => void }) {
  const data = useLazyLoadQuery<ManageAiBalanceModalQueryType>(
    manageAiBalanceModalQuery,
    {},
    { fetchPolicy: 'store-or-network' },
  );

  const aiCatalogProduct = data.billingPlan?.products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;
  const aiSubscriptionProduct =
    data.subscription?.products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;

  return (
    <ManageAiBalanceForm
      data={{
        settings: toAutoTopUpStatus(data.autoTopUpSettings),
        tokenPrice: aiTokenPrice(aiCatalogProduct, aiSubscriptionProduct),
      }}
      onClose={onClose}
    />
  );
}
