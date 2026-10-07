'use client';

import { CloudIcon, XmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { fetchQuery, graphql, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import type { consentAnnouncementBannerQuery as BannerQueryType } from '@/__generated__/consentAnnouncementBannerQuery.graphql';
import { ContentErrorBoundary, SectionLoadError, useRetryKey } from '@/app/components/shared';
import { useAdminGate } from '@/app/hooks/use-admin-gate';
import { loadErrorProps } from '@/lib/query-state';
import { useDismissConsentAnnouncement } from './use-dismiss-consent-announcement';

// `message` is the backend's ready-made sentence; `providers` and `features` are there for a custom layout.
const consentAnnouncementBannerQuery = graphql`
  query consentAnnouncementBannerQuery {
    directoryConsentAnnouncement {
      message
    }
  }
`;

function AnnouncementAlert() {
  const retryKey = useRetryKey();
  const environment = useRelayEnvironment();
  const data = useLazyLoadQuery<BannerQueryType>(
    consentAnnouncementBannerQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // The dismiss answers only `true`; the authoritative "nothing to announce" is the query's own null.
  const { dismiss, isDismissing } = useDismissConsentAnnouncement(() => {
    fetchQuery(environment, consentAnnouncementBannerQuery, {}, { fetchPolicy: 'network-only' }).subscribe({});
  });
  const announcement = data.directoryConsentAnnouncement;
  if (!announcement) return null;

  return (
    <Alert
      variant="warning"
      role="status"
      className="mb-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-s)]"
    >
      <span className="shrink-0">
        <CloudIcon size={24} />
      </span>
      <p className="min-w-0 flex-1 text-h3">{announcement.message}</p>
      <Button
        variant="transparent"
        size="icon-sm"
        className="shrink-0"
        aria-label="Dismiss for this workspace"
        onClick={dismiss}
        disabled={isDismissing}
        leftIcon={<XmarkIcon />}
      />
    </Alert>
  );
}

/**
 * The tenant-wide re-consent notice above the tenant list: a release started asking for permissions
 * the connected tenants have not granted (`directoryConsentAnnouncement`). One banner for both
 * providers; each connection re-authorizes through its own Reconnect. Owners and admins only — the
 * query refuses everyone else — and a failure here is a strip, never the page.
 */
export function ConsentAnnouncementBanner() {
  const gate = useAdminGate();
  if (gate !== 'admin') return null;

  return (
    <ContentErrorBoundary
      label="ConsentAnnouncementBanner"
      fallback={(retry, { isOffline }) => (
        <SectionLoadError {...loadErrorProps(isOffline, "Couldn't check for re-authorization notices.", retry)} />
      )}
    >
      <Suspense fallback={null}>
        <AnnouncementAlert />
      </Suspense>
    </ContentErrorBoundary>
  );
}
