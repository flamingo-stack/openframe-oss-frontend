'use client';

import {
  type AuthSsoProvider,
  CreateOrganizationForm,
  PROVIDER_META,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { DomainSuggestions } from '@/app/(auth)/auth/components/domain-suggestions';
import { ORG_NAME_ERROR, ORG_NAME_REGEX } from '@/app/(auth)/auth/constants/registration-validation';
import { useOrganizationDomain } from '@/app/(auth)/auth/hooks/use-organization-domain';
import { isSharedAuthUi } from '@/lib/app-mode';
import { SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';

/** The authorization server's id for the built-in provider; the design system calls it `openframe`. */
const OPENFRAME_SSO_ID = 'openframe-sso';

/** Display name for a provider id from either the design system or the authorization server. */
function ssoProviderLabel(provider: string): string {
  const key = (provider === OPENFRAME_SSO_ID ? 'openframe' : provider) as AuthSsoProvider;
  return PROVIDER_META[key]?.name ?? provider;
}

/** The verified identity the provider asserted. */
export interface SsoSetupIdentity {
  /**
   * The address the provider asserted, shown read-only. Absent hides the field entirely: the native Apple path may
   * only hold a Hide My Email relay the user has never seen and could not retype. Either way it is never editable:
   * the server reads the address from the verified identity and ignores anything sent from here.
   */
  email?: string;
  /** The provider id, from the design system or the authorization server. */
  provider: string;
}

interface SsoOrganizationSetupProps {
  /** The identity, or `null` while it is read: the form then draws its own loading state. */
  identity: SsoSetupIdentity | null;
  /**
   * Receives the validated organization details, with the subdomain already expanded to a full
   * tenant domain. Throwing surfaces the message and leaves the form up; a caller that navigates
   * away should simply never resolve.
   */
  onSubmit: (values: { tenantName: string; tenantDomain: string }) => void | Promise<void>;
  /** Held disabled after a submit that navigates away, so the form cannot re-arm under it. */
  isSubmitting?: boolean;
  /**
   * Abandons the flow. Supplied by the native Apple path, where this form is the only thing on
   * screen and the tab selector leads to a different form rather than out of it — without a way
   * back the user is stuck holding a credential they cannot use here.
   */
  onBack?: () => void;
}

/**
 * Organization form for an SSO identity that authenticated successfully but has no account yet.
 *
 * Shared by the two ways to reach that state — the web `sso-continue` page, where the identity
 * lives in the SAS session, and the native Apple sheet, where it lives in a single-use credential
 * held in memory. Both then collect exactly the same thing, differing only in how the submit
 * leaves: a top-level navigation for the session flow, a bridge call for the native one.
 *
 * While the identity is read (`identity` null, or a loading scope) the form draws itself with its static copy real,
 * the subtitle a text bar and the submit held off; its fields draw their own loading form.
 */
export function SsoOrganizationSetup({ identity, onSubmit, isSubmitting = false, onBack }: SsoOrganizationSetupProps) {
  const { toast } = useToast();
  const loading = useLoadingScope() || !identity;
  const label = identity ? ssoProviderLabel(identity.provider) : '';
  // While the identity is read the email field is drawn (most identities carry one), as its own loading form.
  const email = identity ? identity.email : '';
  const isSharedAuth = isSharedAuthUi();

  const [organizationName, setOrganizationName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const domainField = useOrganizationDomain(organizationName);

  const isOrgNameValid = ORG_NAME_REGEX.test(organizationName.trim());
  const isValid = isOrgNameValid && !!domainField.domain.trim() && !domainField.isBlocked && agreedToTerms;
  const busy = isSubmitting || domainField.isChecking;

  const handleSubmit = async () => {
    if (!isValid || busy) return;
    try {
      // Re-checked at submit: the debounced status can be stale by the time the button is pressed,
      // and on the native path losing that race costs a single-use Apple authorization code.
      const tenantDomain = await domainField.confirmAvailability();
      if (!tenantDomain) return;
      await onSubmit({ tenantName: organizationName.trim(), tenantDomain });
    } catch (error) {
      toast({
        title: "Couldn't create your organization",
        description: error instanceof Error && error.message ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <CreateOrganizationForm
      title="Finish setting up"
      // Read ("Continuing as … via …"): `null` while the identity is read, which the form draws as a bar of its line.
      subtitle={
        loading || !identity
          ? null
          : identity.email
            ? `Continuing as ${identity.email} via ${label}.`
            : `Continuing via ${label}.`
      }
      email={email}
      emailReadOnly={email !== undefined}
      emailReadOnlyLabel={label && `Signed in with ${label}`}
      organizationName={organizationName}
      domain={domainField.domain}
      agreedToTerms={agreedToTerms}
      onOrganizationNameChange={setOrganizationName}
      onDomainChange={domainField.setDomain}
      onAgreedToTermsChange={setAgreedToTerms}
      onSubmit={handleSubmit}
      submitLabel="Create Organization"
      onBack={onBack}
      submitDisabled={loading || !isValid || busy}
      loading={busy}
      domainSuffix={isSharedAuth ? `.${SAAS_DOMAIN_SUFFIX}` : undefined}
      termsUrl={TERMS_URL}
      privacyPolicyUrl={PRIVACY_POLICY_URL}
      domainSlot={
        domainField.suggestions.length > 0 ? (
          <DomainSuggestions suggestions={domainField.suggestions} onSelect={domainField.setDomain} />
        ) : undefined
      }
      domainStatus={domainField.statusMessage}
      errors={{
        organizationName: organizationName.trim() && !isOrgNameValid ? ORG_NAME_ERROR : undefined,
        domain: domainField.formatError,
      }}
    />
  );
}
