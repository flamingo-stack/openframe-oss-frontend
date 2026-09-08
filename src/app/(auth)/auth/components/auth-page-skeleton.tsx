'use client';

import { AuthShell } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';

export type AuthPageSkeletonVariant = 'signup' | 'login' | 'complete-account';

interface AuthPageSkeletonProps {
  variant?: AuthPageSkeletonVariant;
}

/** Label + input placeholder matching the core `Input` with a text-h4 label. */
function FieldSkeleton() {
  return (
    <div className="flex w-full flex-col">
      <Skeleton className="mb-1 h-5 w-28 md:h-6" />
      <Skeleton className="h-11 w-full rounded-[6px] md:h-12" />
    </div>
  );
}

/** Placeholder matching the default-size core `Button`. */
function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`h-10 rounded-md md:h-12 ${className ?? ''}`} />;
}

/**
 * The stacked provider buttons, in the same `flex-col` with the same gap `SsoProviderButtons` uses.
 * Three of them: `useIsApplePlatform` currently returns true unconditionally, so Google, Microsoft
 * and Apple all render.
 */
function SsoProviderButtonsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <ButtonSkeleton className="w-full" />
      <ButtonSkeleton className="w-full" />
      <ButtonSkeleton className="w-full" />
    </div>
  );
}

/** The labelled rule between the provider buttons and the email field. */
function DividerSkeleton() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-s)]">
      <div className="h-px flex-1 bg-ods-border" />
      <Skeleton className="h-4 w-44" />
      <div className="h-px flex-1 bg-ods-border" />
    </div>
  );
}

/** Title + subtitle placeholder matching the form header (text-h2 + text-h4). */
function HeaderSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="my-1 h-6 w-56 md:h-8 md:w-80" />
      <Skeleton className="my-0.5 h-4 w-72 max-w-full md:h-5 md:w-96" />
    </div>
  );
}

/**
 * Step one of Sign Up, which is a `LoginForm`: email, then Continue.
 *
 * No provider buttons and no divider — unlike the login screen, this page's providers arrive from
 * `useRegistrationProviders`, so the first real paint has none either and matching it is what keeps
 * the transition still.
 */
function SignupFormSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <FieldSkeleton />
      {/* Continue: full width on a phone, half the row and right-aligned from `md` up */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <div className="hidden flex-1 md:block" />
        <ButtonSkeleton className="w-full md:flex-1" />
      </div>
    </>
  );
}

/**
 * Providers first (they need nothing typed), then the email — and nothing else.
 *
 * The login screen has no submit: the tenant's own SSO buttons appear under the field only once an
 * address has resolved to a tenant, which cannot have happened yet while this is on screen.
 */
function LoginFormSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <SsoProviderButtonsSkeleton />
      <DividerSkeleton />
      <FieldSkeleton />
    </>
  );
}

function CompleteAccountFormSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      {/* SSO shortcuts load after the providers request — skeleton matches the initial no-SSO render */}
      <FieldSkeleton />
      <FieldSkeleton />
      <FieldSkeleton />
      <FieldSkeleton />
      {/* Back + submit */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <ButtonSkeleton className="flex-1" />
        <ButtonSkeleton className="flex-1" />
      </div>
    </>
  );
}

const FORM_SKELETONS: Record<AuthPageSkeletonVariant, () => React.ReactNode> = {
  signup: SignupFormSkeleton,
  login: LoginFormSkeleton,
  'complete-account': CompleteAccountFormSkeleton,
};

/**
 * Just the card, for routes whose shell is already on screen.
 *
 * The two tab routes share a layout that owns the AuthShell and the tab selector, so their loading
 * state must replace only what is actually loading — the card. The tabs are two fixed labels that
 * never load, and skeletoning them made a switch look like a full page rebuild.
 */
export function AuthFormSkeleton({ variant = 'signup' }: { variant?: AuthPageSkeletonVariant }) {
  const FormSkeleton = FORM_SKELETONS[variant];

  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]"
    >
      <FormSkeleton />
    </div>
  );
}

/**
 * Loading placeholder for auth pages that bring their own shell (invite, and friends). Renders the
 * real AuthShell — branding and benefits are static — around {@link AuthFormSkeleton}, so there is
 * no layout shift on load.
 */
export function AuthPageSkeleton({ variant = 'signup' }: AuthPageSkeletonProps) {
  return (
    <AuthShell>
      <AuthFormSkeleton variant={variant} />
    </AuthShell>
  );
}
