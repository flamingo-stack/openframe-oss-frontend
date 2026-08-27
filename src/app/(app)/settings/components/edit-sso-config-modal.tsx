'use client';

import { AllowedDomainsInput, Button, CheckboxWithDescription, Label } from '@flamingo-stack/openframe-frontend-core';
import {
  CheckIcon,
  Copy02Icon,
  EyeIcon,
  EyeOffIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Input,
  ModalV2Title,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { validateEmailDomain } from '@flamingo-stack/openframe-frontend-core/utils';
import React, { useEffect, useMemo, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { runtimeEnv } from '@/lib/runtime-config';
import type { AvailableProvider } from '../hooks/use-sso-config';

interface SsoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `create` shows the provider dropdown and starts from a blank form. Default `edit`. */
  mode?: 'create' | 'edit';
  /** Providers without a stored configuration — the dropdown options in `create` mode. */
  providerOptions?: AvailableProvider[];
  providerKey: string;
  providerDisplayName: string;
  initialClientId?: string | null;
  initialClientSecret?: string | null;
  initialMsTenantId?: string | null;
  initialAutoProvisionUsers?: boolean;
  initialAllowedDomains?: string[];
  onSubmit?: (data: {
    provider: string;
    clientId: string;
    clientSecret: string;
    msTenantId?: string | null;
    autoProvisionUsers?: boolean;
    allowedDomains?: string[];
  }) => Promise<void>;
}

export function SsoConfigModal({
  isOpen,
  onClose,
  mode = 'edit',
  providerOptions,
  providerKey,
  providerDisplayName,
  initialClientId,
  initialClientSecret,
  initialMsTenantId,
  initialAutoProvisionUsers,
  initialAllowedDomains,
  onSubmit,
}: SsoConfigModalProps) {
  const { copy: copyToClipboard, copied } = useCopyToClipboard({
    successDescription: 'Redirect URL copied to clipboard',
    errorDescription: 'Unable to copy redirect URL',
  });
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isSingleTenant, setIsSingleTenant] = useState(false);
  const [msTenantId, setMsTenantId] = useState('');
  const [autoProvisionUsers, setAutoProvisionUsers] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const { toast } = useToast();

  const isCreate = mode === 'create';
  const effectiveProviderKey = isCreate ? selectedProvider : providerKey;
  const effectiveDisplayName = isCreate
    ? (providerOptions?.find(option => option.provider === selectedProvider)?.displayName ?? '')
    : providerDisplayName;

  const isMicrosoft = effectiveProviderKey.toLowerCase() === 'microsoft';

  const redirectUrl = useMemo(() => {
    const sharedHost = runtimeEnv.sharedHostUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${sharedHost}/sas/login/oauth2/code/${effectiveProviderKey.toLowerCase()}`;
  }, [effectiveProviderKey]);

  const handleCopyRedirectUrl = () => copyToClipboard(redirectUrl);

  useEffect(() => {
    if (isOpen) {
      setClientId(initialClientId || '');
      setClientSecret(initialClientSecret || '');
      setMsTenantId(initialMsTenantId || '');
      setIsSingleTenant(!!initialMsTenantId);
      setAutoProvisionUsers(initialAutoProvisionUsers || false);
      setAllowedDomains(initialAllowedDomains || []);
      setDomainError(null);
      setShowSecret(false);
    }
  }, [
    isOpen,
    initialClientId,
    initialClientSecret,
    initialMsTenantId,
    initialAutoProvisionUsers,
    initialAllowedDomains,
  ]);

  // Create mode: preselect the first free provider. Idempotent under
  // `providerOptions` identity churn — an in-options selection is kept.
  useEffect(() => {
    if (!isOpen || !isCreate) return;
    setSelectedProvider(prev =>
      providerOptions?.some(option => option.provider === prev) ? prev : (providerOptions?.[0]?.provider ?? ''),
    );
  }, [isOpen, isCreate, providerOptions]);

  const canSubmit = useMemo(() => {
    if (isCreate && !effectiveProviderKey) return false;
    const hasBasicFields = clientId.trim().length > 0 && clientSecret.trim().length > 0;
    if (isMicrosoft && isSingleTenant) {
      if (!hasBasicFields || msTenantId.trim().length === 0) return false;
    }
    if (!hasBasicFields) return false;
    // If auto-provision is enabled, require at least one domain
    if (autoProvisionUsers && allowedDomains.length === 0) {
      return false;
    }
    return true;
  }, [
    isCreate,
    effectiveProviderKey,
    clientId,
    clientSecret,
    isMicrosoft,
    isSingleTenant,
    msTenantId,
    autoProvisionUsers,
    allowedDomains,
  ]);

  const handleSubmit = async () => {
    if (!canSubmit || !onSubmit) return;
    setIsSubmitting(true);
    try {
      const data: {
        provider: string;
        clientId: string;
        clientSecret: string;
        msTenantId?: string | null;
        autoProvisionUsers?: boolean;
        allowedDomains?: string[];
      } = {
        provider: effectiveProviderKey,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      };
      if (isMicrosoft) {
        data.msTenantId = isSingleTenant && msTenantId.trim() ? msTenantId.trim() : null;
      }
      data.autoProvisionUsers = autoProvisionUsers;
      data.allowedDomains = autoProvisionUsers ? allowedDomains : [];
      await onSubmit(data);
      toast({
        title: 'SSO Enabled',
        description: `${effectiveDisplayName || effectiveProviderKey} configuration saved and enabled`,
        variant: 'success',
      });
      onClose();
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Failed to update SSO configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px] w-full"
      header={<ModalV2Title>{isCreate ? 'New SSO Configuration' : 'Edit SSO Configuration'}</ModalV2Title>}
      footer={
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            className="flex-1"
          >
            {isCreate ? 'Save Configuration' : 'Update Configuration'}
          </Button>
        </div>
      }
      // Load-bearing, not styling: contentClassName is what opts the body into
      // ModalV2Content's `flex-1 min-h-0 overflow-y-auto`. Without it these
      // children are direct flex items of a panel that has no overflow of its
      // own, so on a phone the form spilled past the max-height and took the
      // footer off-screen — Save was unreachable.
      contentClassName="flex flex-col gap-6"
    >
      {/* Redirect URL Section — measured from the mockups: mobile box 12 / row 40 / icon 16 / gaps 4, desktop box 16 / row 56 / icon 24 / gaps 8; the copy control is a bare icon with no padding of its own */}
      <div className="bg-ods-card border border-ods-border rounded-lg p-3 space-y-1 md:p-4 md:space-y-2">
        <Label variant="large">Authorized redirect URL for your SSO provider settings:</Label>
        <div className="bg-ods-bg border border-ods-border rounded-lg h-10 px-3 md:h-14 md:px-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <TruncateText className="text-code">{redirectUrl}</TruncateText>
          </div>
          <button
            type="button"
            aria-label="Copy redirect URL"
            onClick={handleCopyRedirectUrl}
            className="shrink-0 flex items-center"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 md:h-6 md:w-6 text-ods-success" />
            ) : (
              <Copy02Icon className="h-4 w-4 md:h-6 md:w-6 text-ods-text-secondary" />
            )}
          </button>
        </div>
        <p className="text-h4 text-ods-text-primary">
          The callback URL must match exactly. Authentication will fail if not properly configured in your SSO provider.
        </p>
      </div>

      {/* Provider picker — selectable while creating, informational on edit */}
      <div className="space-y-2">
        <Label variant="large">OAuth Provider</Label>
        <Select value={effectiveProviderKey} onValueChange={setSelectedProvider} disabled={!isCreate || isSubmitting}>
          <SelectTrigger>
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {(isCreate ? (providerOptions ?? []) : [{ provider: providerKey, displayName: providerDisplayName }])
              .filter(option => option.provider)
              .map(option => (
                <SelectItem key={option.provider} value={option.provider}>
                  {option.displayName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Credentials — side by side on desktop (design 1-38427), stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label variant="large">OAuth Client ID</Label>
          <Input
            placeholder="Enter OAuth Client ID"
            value={clientId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
            className="bg-ods-card"
          />
        </div>

        <div className="space-y-2">
          <Label variant="large">Client Secret</Label>
          <Input
            type={showSecret ? 'text' : 'password'}
            placeholder="Enter Client Secret"
            value={clientSecret}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientSecret(e.target.value)}
            className="bg-ods-card"
            endAdornment={
              <button
                type="button"
                aria-label={showSecret ? 'Hide client secret' : 'Show client secret'}
                onClick={() => setShowSecret(!showSecret)}
                className="flex items-center"
              >
                {showSecret ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
        </div>
      </div>

      {/* Microsoft-specific: Single Tenant Configuration */}
      {isMicrosoft && (
        <div className="space-y-4">
          <CheckboxWithDescription
            id="single-tenant"
            checked={isSingleTenant}
            onCheckedChange={checked => {
              setIsSingleTenant(checked);
              if (!checked) {
                setMsTenantId('');
              }
            }}
            title="Single Tenant"
            description="Use single-tenant authentication for this provider"
            className="items-center [&_label]:text-h4 [&>button]:mt-0 [&>button]:bg-transparent"
          />

          {isSingleTenant && (
            <div className="space-y-2">
              <Label variant="large">Tenant ID</Label>
              <Input
                placeholder="Enter Tenant ID"
                value={msTenantId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMsTenantId(e.target.value)}
                className="bg-ods-card"
              />
            </div>
          )}
        </div>
      )}

      <CheckboxWithDescription
        id="auto-provision-users"
        checked={autoProvisionUsers}
        onCheckedChange={setAutoProvisionUsers}
        title="Allow All Users from Domain"
        description="Automatically grant access to all users with email addresses from your organization's domain."
        className="items-center [&_label]:text-h4 [&>button]:mt-0 [&>button]:bg-transparent"
      />

      {autoProvisionUsers && (
        <AllowedDomainsInput
          value={allowedDomains}
          onChange={setAllowedDomains}
          onValidate={domain => {
            const validation = validateEmailDomain(domain);
            return {
              valid: validation.valid,
              error: validation.error,
              cleanedDomain: validation.cleanedDomain,
            };
          }}
          label="Allowed Domains"
          placeholder="openframe.com"
          disabled={isSubmitting}
          error={domainError}
          className="[&_label]:text-h4 [&>button>span]:text-h4"
        />
      )}
    </SimpleModal>
  );
}

// Re-export with old name for backwards compatibility
export { SsoConfigModal as EditSsoConfigModal };
