'use client';

import { CreateOrganizationForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useState } from 'react';
import { DomainSuggestions } from '@/app/(auth)/auth/components/domain-suggestions';
import { ORG_NAME_ERROR, ORG_NAME_REGEX } from '@/app/(auth)/auth/constants/registration-validation';
import { useOrganizationDomain } from '@/app/(auth)/auth/hooks/use-organization-domain';
import { isSharedAuthUi } from '@/lib/app-mode';
import { SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';

interface SsoOrganizationSetupProps {
  /**
   * The address the provider asserted, shown read-only. Omit it to hide the field entirely — the
   * native Apple path may only hold a Hide My Email relay the user has never seen and could not
   * retype. Either way it is never editable: the server reads the address from the verified
   * identity and ignores anything sent from here.
   */
  email?: string;
  /** Label above the read-only email, e.g. "Signed in with Google". */
  emailReadOnlyLabel?: string;
  subtitle: ReactNode;
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
 */
export function SsoOrganizationSetup({
  email,
  emailReadOnlyLabel,
  subtitle,
  onSubmit,
  isSubmitting = false,
  onBack,
}: SsoOrganizationSetupProps) {
  const { toast } = useToast();
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
      subtitle={subtitle}
      email={email}
      emailReadOnly={email !== undefined}
      emailReadOnlyLabel={emailReadOnlyLabel}
      organizationName={organizationName}
      domain={domainField.domain}
      agreedToTerms={agreedToTerms}
      onOrganizationNameChange={setOrganizationName}
      onDomainChange={domainField.setDomain}
      onAgreedToTermsChange={setAgreedToTerms}
      onSubmit={handleSubmit}
      submitLabel="Create Organization"
      onBack={onBack}
      submitDisabled={!isValid || busy}
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
      }}
    />
  );
}
