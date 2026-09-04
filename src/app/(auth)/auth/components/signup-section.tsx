'use client';

import { AuthProvidersList } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Button, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useRegistrationProviders } from '@/app/(auth)/auth/hooks/use-registration-providers';
import { isSaasSharedMode } from '@/lib/app-mode';

interface RegisterRequest {
  tenantName: string;
  tenantDomain: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthSignupSectionProps {
  orgName: string;
  domain: string;
  email?: string;
  onSubmit: (data: RegisterRequest) => void;
  onSso?: (provider: string) => void;
  onBack: () => void;
  isLoading: boolean;
}

/**
 * Signup section for completing user registration
 */
export function AuthSignupSection({
  orgName,
  domain,
  email: prefillEmail,
  onSubmit,
  onSso,
  onBack,
  isLoading,
}: AuthSignupSectionProps) {
  const isSaasShared = isSaasSharedMode();
  const { providers: ssoProviders, loading: loadingProviders } = useRegistrationProviders();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [, setSignupMethod] = useState<'form' | 'sso'>('form');

  const displayDomain = isSaasShared ? domain : domain;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email.trim());

  const getTitle = () => 'Create Organization';
  const getSubtitle = () => 'Start your journey with OpenFrame';
  const getButtonText = () => (isSaasShared ? 'Start Free Trial' : 'Create Organization');

  const isFormValid =
    firstName.trim() && lastName.trim() && isEmailValid && password && confirmPassword && password === confirmPassword;

  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim() || !isEmailValid || !password || password !== confirmPassword) {
      return;
    }

    const data: RegisterRequest = {
      tenantName: orgName,
      tenantDomain: domain,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    };

    onSubmit(data);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && isFormValid) {
      handleSubmit();
    }
  };

  const handleSsoClick = async (provider: string) => {
    setSignupMethod('sso');
    if (onSso) {
      onSso(provider);
    }
  };

  return (
    <div className="w-full">
      <div className="w-full space-y-6 lg:space-y-10">
        {/* Complete Your Registration Section */}
        <div className="rounded-sm border border-ods-border bg-ods-card p-10">
          <div className="mb-6">
            <h1 className="mb-2 text-ods-text-primary text-h2">{getTitle()}</h1>
            <p className="text-ods-text-secondary text-h4">{getSubtitle()}</p>
          </div>

          {/* SSO Options for SaaS Shared Mode */}
          {ssoProviders.length > 0 && onSso && (
            <div className="mb-6">
              <AuthProvidersList
                enabledProviders={ssoProviders}
                onProviderClick={handleSsoClick}
                dividerText="Sign up with"
                loading={isLoading || loadingProviders}
              />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-ods-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-ods-card px-2 text-ods-text-secondary text-h6">Or continue with email</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6" onClick={() => setSignupMethod('form')}>
            {/* Organization details (disabled) */}
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <Label>Organization Name</Label>
                <Input
                  value={orgName}
                  disabled
                  onKeyDown={handleKeyDown}
                  className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label>Domain</Label>
                <Input
                  value={displayDomain}
                  disabled
                  onKeyDown={handleKeyDown}
                  className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4"
                />
              </div>
            </div>

            {/* Personal details */}
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <Label>First Name</Label>
                <Input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your First Name"
                  disabled={isLoading}
                  className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4 placeholder:text-ods-text-secondary"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label>Last Name</Label>
                <Input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your Last Name"
                  disabled={isLoading}
                  className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4 placeholder:text-ods-text-secondary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="username@mail.com"
                disabled={isLoading || !!prefillEmail}
                className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4 placeholder:text-ods-text-secondary"
              />
              {email.trim() && !isEmailValid && (
                <p className="mt-1 text-ods-error text-h6">Enter a valid email address</p>
              )}
            </div>

            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={'Choose a Strong Password'}
                  disabled={isLoading}
                  className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4 placeholder:text-ods-text-secondary"
                />
                {isSaasShared && password && password.length < 8 && (
                  <p className="mt-1 text-ods-error text-h6">Password must be at least 8 characters</p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Confirm your Password"
                  disabled={isLoading}
                  className="border-ods-border bg-ods-card p-3 text-ods-text-secondary text-h4 placeholder:text-ods-text-secondary"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-ods-error text-h6">Passwords do not match</p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:gap-6">
              <Button onClick={onBack} disabled={isLoading} variant="outline" className="w-full md:flex-1">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid || isLoading}
                loading={isLoading}
                variant="accent"
                className="w-full md:flex-1"
              >
                {getButtonText()}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
