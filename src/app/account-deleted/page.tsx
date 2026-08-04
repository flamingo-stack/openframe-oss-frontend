'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { useEffect, useState } from 'react';
import { DELETED_ACCOUNT_ORG_STORAGE_KEY } from '@/app/(app)/settings/hooks/use-account-deletion';

/**
 * Full-screen terminal page shown right after successful account
 * self-deletion. Lives OUTSIDE the `(app)` and `(auth)` route groups on
 * purpose: the visitor is signed out by the time it renders, so it must not
 * sit behind the app layout's auth gate, and saas-tenant (web) blocks the
 * `/auth` subtree entirely.
 *
 * There is no way back from here by design — the deletion flow `replace`s
 * onto this URL, so Back lands on a guarded app route that bounces a
 * signed-out visitor to the mode's sign-in surface.
 *
 * The organization name is handed over via sessionStorage (the session that
 * knew it is gone); read in an effect — not a state initializer — because the
 * page is prerendered (static export) and a server/client copy mismatch would
 * break hydration. A missing value degrades to generic wording.
 */
export default function AccountDeletedPage() {
  const [organizationName, setOrganizationName] = useState('');

  useEffect(() => {
    try {
      setOrganizationName(sessionStorage.getItem(DELETED_ACCOUNT_ORG_STORAGE_KEY) || '');
    } catch {
      // Storage unavailable — keep the generic copy.
    }
  }, []);

  return (
    <div className="min-h-screen bg-ods-bg flex flex-col items-center justify-between p-10">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center gap-2 max-w-[600px] text-center">
        <h1 className="text-h2 text-ods-text-primary">Your account has been deleted</h1>
        <p className="text-h4 text-ods-text-secondary">
          You no longer have access to {organizationName || 'your organization'}. An email with the details has been
          sent to your email.
        </p>
      </div>

      {/* Footer */}
      <a
        href="https://flamingo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-4 text-ods-text-secondary rounded-md bg-transparent hover:bg-ods-bg-hover transition-colors"
      >
        <span className="text-h6">Powered by</span>
        <FlamingoLogo className="h-5 w-5" fill="currentColor" />
        <span className="text-code font-semibold">Flamingo</span>
      </a>
    </div>
  );
}
