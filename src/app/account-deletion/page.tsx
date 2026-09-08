'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { routes } from '@/lib/routes';

/**
 * Public account-deletion instructions — the URL handed to Google Play's
 * "Data deletion" field.
 *
 * Google requires that URL to be reachable from a browser without installing
 * the app, and to serve someone who CANNOT sign in: an ex-employee, a user an
 * admin disabled, anyone who lost their password. That rules out pointing the
 * store listing at Settings → Profile, which is where the self-service action
 * actually lives. So the page is public and unauthenticated; the *action* it
 * links to stays gated, which is what the policy asks for.
 *
 * Lives OUTSIDE `(app)` and `(auth)` for the same reason `/account-deleted`
 * does — no auth gate, no app chrome, and saas-tenant (web) blocks the `/auth`
 * subtree outright. `of-standalone-shell` supplies the native safe-area insets
 * that AppLayout/AuthShell would otherwise apply (globals.css).
 *
 * Host: the canonical URL is on the SHARED host, the only one identical for
 * every tenant — tenant gateway hosts are learned at login. Internal links are
 * relative on purpose so they resolve against whichever host served the page.
 */
export default function AccountDeletionPage() {
  return (
    <div className="of-standalone-shell flex min-h-screen flex-col items-center gap-[var(--spacing-system-xlf)] bg-ods-bg p-[var(--spacing-system-xlf)]">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      <main className="flex w-full max-w-[640px] flex-col gap-[var(--spacing-system-lf)]">
        <header className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <h1 className="text-ods-text-primary text-h2">Delete your OpenFrame account</h1>
          <p className="text-ods-text-secondary text-h6">
            OpenFrame accounts belong to a workspace created by the organization you work with. You can delete your own
            account at any time, whether or not you still have access to it.
          </p>
        </header>

        <section className="flex flex-col gap-[var(--spacing-system-sf)]">
          <h2 className="text-ods-text-primary text-h4">If you can sign in</h2>
          <ol className="flex list-decimal flex-col gap-[var(--spacing-system-xxs)] pl-[var(--spacing-system-mf)] text-ods-text-secondary text-h6">
            <li>Sign in to OpenFrame.</li>
            <li>
              Open <span className="text-ods-text-primary">Settings</span> →{' '}
              <span className="text-ods-text-primary">Profile</span>.
            </li>
            <li>
              Select <span className="text-ods-text-primary">Delete Account</span> and confirm.
            </li>
          </ol>
          <p className="text-ods-text-secondary text-h6">
            Deletion takes effect immediately and signs you out on every device.
          </p>
          <p className="text-ods-text-secondary text-h6">
            If you are the <span className="text-ods-text-primary">owner</span> of the workspace, the dialog first asks
            you to hand ownership to another active member, and the button reads{' '}
            <span className="text-ods-text-primary">Transfer &amp; Delete Account</span>. A workspace cannot be left
            without an owner, so if you are its only member, invite someone else before deleting your account — or
            contact us using the details below.
          </p>
          <a
            href={routes.auth.login}
            className="self-start rounded-md bg-ods-card px-[var(--spacing-system-mf)] py-[var(--spacing-system-xsf)] font-semibold text-ods-text-primary transition-colors text-h6 hover:bg-ods-bg-hover"
          >
            Sign in to delete your account
          </a>
        </section>

        <section className="flex flex-col gap-[var(--spacing-system-sf)]">
          <h2 className="text-ods-text-primary text-h4">If you can&apos;t sign in</h2>
          <p className="text-ods-text-secondary text-h6">
            If you have left the organization, forgotten your password, or an administrator has disabled your account,
            email{' '}
            <a href="mailto:support@openframe.ai" className="text-ods-text-primary underline">
              support@openframe.ai
            </a>{' '}
            with the subject <span className="text-ods-text-primary">Account deletion request</span> and the email
            address of the account you want deleted. We will verify the request before acting on it and confirm once the
            account has been removed.
          </p>
        </section>

        <section className="flex flex-col gap-[var(--spacing-system-sf)]">
          <h2 className="text-ods-text-primary text-h4">What happens to your data</h2>
          <ul className="flex list-disc flex-col gap-[var(--spacing-system-xsf)] pl-[var(--spacing-system-mf)] text-ods-text-secondary text-h6">
            <li>
              Your personal profile information is anonymized on our servers and can no longer be used to identify you.
            </li>
            <li>
              Your credentials and active sessions are revoked immediately, and push notification registrations for your
              devices are removed.
            </li>
            <li>
              Work records created inside your organization&apos;s workspace — such as tickets and activity history —
              remain with the organization that owns the workspace, with your personal identity removed. Those records
              belong to the organization rather than to your individual account.
            </li>
            <li>
              An account removed by an administrator is handled differently: profile information is retained so the
              account can be restored by re-invitation. Only deletion you request yourself anonymizes it.
            </li>
          </ul>
        </section>
      </main>

      <a
        href="https://flamingo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center gap-[var(--spacing-system-xsf)] rounded-md bg-transparent p-[var(--spacing-system-mf)] text-ods-text-secondary transition-colors hover:bg-ods-bg-hover"
      >
        <span className="text-h6">Powered by</span>
        <FlamingoLogo className="h-5 w-5" fill="currentColor" />
        <span className="font-semibold text-code">Flamingo</span>
      </a>
    </div>
  );
}
