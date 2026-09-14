'use client';

import { AuthProvidersList } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';

interface TenantInfo {
  tenantName: string;
  tenantDomain: string;
}

interface SsoProvider {
  provider: string;
  enabled: boolean;
  displayName?: string;
}

interface AuthLoginSectionProps {
  email: string;
  tenantInfo: TenantInfo | null;
  hasDiscoveredTenants: boolean;
  availableProviders: string[];
  onSso: (provider: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  onEmailPasswordLogin?: (email: string, password: string) => Promise<void>;
}

/**
 * Modern login section with SSO providers and email/password option
 */
export function AuthLoginSection({
  email,
  tenantInfo,
  hasDiscoveredTenants,
  availableProviders,
  onSso,
  onBack,
  isLoading,
  onEmailPasswordLogin,
}: AuthLoginSectionProps) {
  const [loginMethod, setLoginMethod] = useState<'sso' | 'email'>('sso');
  const [password, setPassword] = useState('');

  // Separate the built-in OpenFrame login from standard providers.
  // The backend reports it as 'openframe'; 'openframe-sso' is the legacy id.
  const OPENFRAME_IDS = ['openframe', 'openframe-sso'];
  const hasOpenFrameSso = availableProviders.some(provider => OPENFRAME_IDS.includes(provider));
  const standardProviders = availableProviders.filter(provider => !OPENFRAME_IDS.includes(provider));

  const enabledProviders: SsoProvider[] = standardProviders.map(provider => ({
    provider: provider,
    enabled: true,
    displayName:
      provider === 'google'
        ? 'Google'
        : provider === 'microsoft'
          ? 'Microsoft'
          : provider === 'slack'
            ? 'Slack'
            : provider === 'github'
              ? 'GitHub'
              : provider.charAt(0).toUpperCase() + provider.slice(1),
  }));

  const handleSsoClick = async (provider: string) => {
    setLoginMethod('sso');
    await onSso(provider);
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEmailPasswordLogin) return;
    setLoginMethod('email');
    await onEmailPasswordLogin(email, password);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-ods-border bg-ods-card shadow-xl">
        {/* Header Section */}
        <div className="p-8 pb-0">
          {/* Icon and Title */}
          <div className="mb-8">
            <h1 className="mb-2 text-ods-text-primary text-h2">Already registered?</h1>
            <p className="text-ods-text-secondary text-h6">Enter you email to access your organization.</p>
            {hasDiscoveredTenants && tenantInfo && (
              <p className="mt-2 text-ods-text-secondary text-h6">
                Signing in to {tenantInfo.tenantName} ({tenantInfo.tenantDomain})
              </p>
            )}
          </div>
        </div>

        {/* Login Form Section */}
        <div className="p-8 pt-0">
          <div className="space-y-6">
            {/* SSO Providers */}
            {(standardProviders.length > 0 || hasOpenFrameSso) && (
              <div className="space-y-3">
                {/* OpenFrame SSO as primary option */}
                {hasOpenFrameSso && (
                  <>
                    <Button
                      onClick={() => handleSsoClick('openframe')}
                      disabled={isLoading}
                      loading={isLoading && loginMethod === 'sso'}
                      variant="accent"
                      className="!w-full"
                    >
                      Sign in with OpenFrame SSO
                    </Button>
                    <Button onClick={onBack} variant="outline" className="!w-full">
                      Back
                    </Button>
                  </>
                )}

                {/* Other SSO Providers */}
                {enabledProviders.length > 0 && (
                  <>
                    {hasOpenFrameSso && (
                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-ods-border"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-ods-card px-3 text-ods-text-secondary text-h6">or continue with</span>
                        </div>
                      </div>
                    )}

                    <AuthProvidersList
                      enabledProviders={enabledProviders.map(p => ({
                        provider: p.provider,
                        enabled: p.enabled,
                      }))}
                      onProviderClick={provider => handleSsoClick(provider)}
                      loading={isLoading && loginMethod === 'sso'}
                      orientation="vertical"
                      showDivider={false}
                    />
                  </>
                )}
              </div>
            )}

            {/* Email/Password fallback */}
            {onEmailPasswordLogin && (
              <form className="space-y-3" onSubmit={handleEmailPasswordSubmit}>
                {(standardProviders.length > 0 || hasOpenFrameSso) && (
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-ods-border"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-ods-card px-3 text-ods-text-secondary text-h6">or use your password</span>
                    </div>
                  </div>
                )}
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-md border border-ods-border bg-ods-card px-3 py-2 text-ods-text-primary"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  loading={isLoading && loginMethod === 'email'}
                  variant="accent"
                  className="!w-full"
                >
                  Sign in with password
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
