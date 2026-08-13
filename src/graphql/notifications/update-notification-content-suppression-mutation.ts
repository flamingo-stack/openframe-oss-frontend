import { graphql } from 'react-relay';

/**
 * Tenant-wide privacy switch (ADMIN/OWNER only, enforced server-side): when suppressed,
 * notification descriptions are replaced with a neutral line across in-app, live socket
 * and push bodies. Distinct from updateNotificationSettings, which is a per-user preference.
 */
export const updateNotificationContentSuppressionMutation = graphql`
  mutation updateNotificationContentSuppressionMutation($suppressed: Boolean!) {
    updateNotificationContentSuppression(suppressed: $suppressed) {
      enabled
      contentSuppressed
    }
  }
`;
