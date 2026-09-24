import { graphql } from 'react-relay';

/**
 * Applies a plan change in place. The response carries what the change can
 * move — status, dates, and the invoices it may raise — so the Relay store is
 * right the moment it lands. `pendingInvoices` spreads the page's own fragment
 * for the reason given on it: a shorter selection here left the store with an
 * invoice the page could not render.
 *
 * `products { packageOptions }`, which is what a plan change actually alters, is
 * NOT returned by the backend; callers refetch for it (see `useUpdateSubscription`).
 */
export const updateSubscriptionMutation = graphql`
  mutation updateSubscriptionMutation($input: UpdateSubscriptionInput!) {
    updateSubscription(input: $input) {
      subscription {
        id
        status
        startDate
        currentPeriodEnd
        cancellationEffectiveAt
        pendingInvoices {
          ...pendingInvoiceFields_invoice
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;
