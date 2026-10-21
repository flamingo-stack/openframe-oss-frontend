'use client';

import { SuperUserBannerView } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Component, type ReactNode, Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { superUserBannerQuery as SuperUserBannerQueryType } from '@/__generated__/superUserBannerQuery.graphql';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { environmentLabel } from '@/lib/environment-label';
import { runtimeEnv } from '@/lib/runtime-config';

/**
 * The tenant whose host answered, which in a super user session is NOT the
 * tenant on `/me` (that one is the super tenant itself). `tenantInfo` resolves
 * against the request's tenant binding, so it names the workspace on screen.
 */
const superUserBannerQuery = graphql`
  query superUserBannerQuery {
    tenantInfo {
      name
    }
  }
`;

/**
 * The environment is the tenant host's, not the page's: a local dev server
 * pointed at QA is looking at QA, and the native shell's page has no hostname
 * at all. The page's own host is the answer only where no tenant host is
 * configured, i.e. the web bundle served by the tenant itself.
 */
function hostLabel(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const tenantHost = runtimeEnv.tenantHostUrl();
  let hostname = window.location.hostname;
  if (tenantHost) {
    try {
      hostname = new URL(tenantHost).hostname;
    } catch {
      // Not a URL: fall through to the page's host.
    }
  }
  return environmentLabel(hostname);
}

function SuperUserBannerContent() {
  const data = useLazyLoadQuery<SuperUserBannerQueryType>(
    superUserBannerQuery,
    {},
    {
      fetchPolicy: 'store-or-network',
      // The strip belongs over the lock screen as much as over any page, and
      // the gate parks app queries while the workspace is locked.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );
  return <SuperUserBannerView tenantName={data.tenantInfo?.name ?? ''} environmentLabel={hostLabel()} />;
}

/**
 * The name arriving a beat late must not cost the strip itself: the Suspense
 * fallback is the same strip in its loading form (the name a bar), and a failed
 * lookup keeps the strip with the name blank instead of unmounting the shell
 * around it.
 */
class SuperUserBannerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[SuperUserBanner] tenant name lookup failed:', error);
  }

  render() {
    if (this.state.failed) return <SuperUserBannerView tenantName="" environmentLabel={hostLabel()} />;
    return this.props.children;
  }
}

/**
 * Shown over every page of a super user session (`/me` `user.isSuperUser`),
 * the lock screen included, and nothing else; a normal tenant user never
 * mounts the query behind it. Mount it once the session has answered, so a
 * persisted flag from a previous session cannot flash it before `/me` does.
 */
export function SuperUserBanner() {
  const isSuperUser = useAuthStore(state => state.user?.isSuperUser === true);
  if (!isSuperUser) return null;

  return (
    <SuperUserBannerBoundary>
      <Suspense fallback={<SuperUserBannerView loading tenantName="" environmentLabel={hostLabel()} />}>
        <SuperUserBannerContent />
      </Suspense>
    </SuperUserBannerBoundary>
  );
}
