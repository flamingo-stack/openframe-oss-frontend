'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { tenantConsentAlert_connection$key } from '@/__generated__/tenantConsentAlert_connection.graphql';
import { consentAlert, isReadable } from '../../utils/tenant-presentation';

// Also spread by "Check Connection", so a probe that answers refreshes the outcome beside the state.
// `issues` only for whether there are any: `TenantConsentIssues` reads and draws them.
const tenantConsentAlertFragment = graphql`
  fragment tenantConsentAlert_connection on DirectoryConnection {
    domain
    access {
      state
    }
    lastConsentInfo {
      outcome
      deniedTiers
      issues {
        __typename
      }
    }
  }
`;

/** How the last consent attempt ended (Figma settings 2885-2333 / 2885-3620); nothing for a clean one. */
export function TenantConsentAlert({ connection }: { connection: tenantConsentAlert_connection$key }) {
  const data = useFragment(tenantConsentAlertFragment, connection);
  const attempt = data.lastConsentInfo;
  const alert = consentAlert(
    attempt && { outcome: attempt.outcome, deniedTiers: attempt.deniedTiers, hasIssues: attempt.issues.length > 0 },
    { readable: isReadable(data.access.state), domain: data.domain },
  );
  if (!alert) return null;

  return (
    <Alert
      variant={alert.variant}
      className="flex items-start gap-[var(--spacing-system-m)] p-[var(--spacing-system-s)]"
      role="status"
    >
      <span className="shrink-0">
        <AlertTriangleIcon size={24} />
      </span>
      <p className="text-h3">{alert.message}</p>
    </Alert>
  );
}
