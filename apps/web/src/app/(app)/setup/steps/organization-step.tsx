'use client';

import { Button, ImageUploader, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useTenantLogoUpload } from '@/app/(app)/onboarding/hooks/use-tenant-logo-upload';
import { useTenantInfo, useUpdateTenantInfo } from '@/app/(app)/settings/hooks/use-tenant-info';
import { getFullImageUrl } from '@/lib/image-url';
import { SetupHeading } from '../components/setup-heading';

type Action = 'skip' | 'continue';

/**
 * "Set Up Your Organization": the tenant's name, website and logo, on the same
 * data layer as the settings "Edit Organization" form. "Continue" saves and then
 * persists the step; "Skip this Step" persists it as is. The logo uploads on
 * pick, as it does everywhere else the tenant logo is edited.
 */
export function OrganizationStep({
  onSkip,
  onSaved,
  persisting,
}: {
  /** Persist the step without saving anything. */
  onSkip: () => void;
  /** The form is saved; persist the step. */
  onSaved: () => void;
  /** The step is being persisted after the chosen action. */
  persisting: boolean;
}) {
  const { data: tenantInfo } = useTenantInfo();
  const updateTenantInfo = useUpdateTenantInfo();
  const logo = useTenantLogoUpload();

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [action, setAction] = useState<Action | null>(null);

  // Seeded during render once the record arrives, from an `undefined` sentinel -
  // see the Initial Setup card's step for why a tracker seeded with the current
  // value never fires on a cached remount.
  const [seededFrom, setSeededFrom] = useState<typeof tenantInfo>(undefined);
  if (tenantInfo !== seededFrom) {
    setSeededFrom(tenantInfo);
    if (tenantInfo) {
      setName(tenantInfo.name ?? '');
      setWebsite(tenantInfo.website ?? '');
      logo.seed(tenantInfo.image);
    }
  }

  const busy = updateTenantInfo.isPending || persisting;

  const handleContinue = () => {
    setAction('continue');
    updateTenantInfo.mutate(
      { name: name.trim(), website: website.trim() },
      { onSuccess: onSaved, onError: () => setAction(null) },
    );
  };

  const handleSkip = () => {
    setAction('skip');
    onSkip();
  };

  return (
    <>
      <SetupHeading
        title="Set Up Your Organization"
        subtitle="Set your company name, upload a logo, and add your website so clients recognize your brand across all touchpoints."
      />
      <div className="flex w-full flex-col gap-[var(--spacing-system-m)]">
        <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2">
          <Input
            id="setup-org-name"
            label="Organization Name"
            value={name}
            onChange={event => setName(event.target.value)}
            disabled={busy}
            placeholder="Flamingo"
          />
          <Input
            id="setup-org-website"
            label="Organization Website"
            value={website}
            onChange={event => setWebsite(event.target.value)}
            disabled={busy}
            placeholder="flamingo.cx"
          />
        </div>
        <ImageUploader
          value={getFullImageUrl(logo.imageUrl, logo.imageHash)}
          onChange={logo.upload}
          onRemove={logo.remove}
          loading={logo.isBusy}
          objectFit="cover"
          maxSize={5 * 1024 * 1024}
          label="Upload Logo"
          description="(Click Here or Drag and Drop)"
          alt={name || 'Organization logo'}
        />
        <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            loading={persisting && action === 'skip'}
            disabled={busy || logo.isBusy}
          >
            Skip this Step
          </Button>
          <Button
            variant="accent"
            onClick={handleContinue}
            loading={action === 'continue' && busy}
            disabled={!name.trim() || busy || logo.isBusy}
          >
            Continue
          </Button>
        </div>
      </div>
    </>
  );
}
