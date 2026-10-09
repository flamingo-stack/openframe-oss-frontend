'use client';

import { Button, Input } from '@flamingo-stack/openframe-frontend-core';
import { CheckCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ImageUploader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useState } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { useTenantInfo, useUpdateTenantInfo } from '../../settings/hooks/use-tenant-info';
import { useTenantLogoUpload } from '../hooks/use-tenant-logo-upload';
import { useStepActionState } from '../use-step-action-state';

/**
 * Inner body of the "Complete MSP Setup" onboarding step. Reuses the same tenant-info
 * data layer and core components as the settings "Edit Organization" form
 * ({@link ../../settings/components/edit-organization-modal}) so both stay in sync.
 */
export function MspSetupStep({
  onComplete,
  completed,
  completing,
}: {
  onComplete?: () => void;
  completed?: boolean;
  completing?: boolean;
}) {
  const { data: tenantInfo } = useTenantInfo();
  const updateTenantInfo = useUpdateTenantInfo();
  const logo = useTenantLogoUpload();

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');

  // Seeded when the tenant record arrives (or is replaced), during render rather
  // than in an effect: an effect renders the empty fields once after the data has
  // landed.
  //
  // The tracker starts at `undefined` as a sentinel rather than at the current
  // value: react-query answers from cache on a remount (collapse and re-expand
  // this step, or a return to the dashboard), so the record is routinely already
  // there on the FIRST render, and a tracker seeded with it never fires — the
  // fields would stay blank. Seeding from an `undefined` `tenantInfo` is a no-op
  // either way, since the body below acts only on a loaded record.
  const [seededFrom, setSeededFrom] = useState<typeof tenantInfo>(undefined);
  if (tenantInfo !== seededFrom) {
    setSeededFrom(tenantInfo);
    if (tenantInfo) {
      setName(tenantInfo.name ?? '');
      setWebsite(tenantInfo.website ?? '');
      logo.seed(tenantInfo.image);
    }
  }

  const handleSave = useCallback(() => {
    // A successful save completes the onboarding step (in addition to the explicit
    // "Mark as Complete" button) — but only the first time, so re-saving an
    // already-complete step doesn't re-fire completion.
    updateTenantInfo.mutate({ name, website }, { onSuccess: () => !completed && onComplete?.() });
  }, [name, website, updateTenantInfo, onComplete, completed]);

  const displayImageUrl = getFullImageUrl(logo.imageUrl, logo.imageHash);
  const isSaving = updateTenantInfo.isPending;
  const actions = useStepActionState({ completing, primaryBusy: isSaving });

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)]">
      {/* Name + Website (left) / Logo (right) */}
      <div className="flex w-full flex-col items-start gap-[var(--spacing-system-l)] content-md:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-[var(--spacing-system-l)]">
          <Input
            id="msp-org-name"
            label="Organization Name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isSaving}
            placeholder="Organization name"
          />
          <Input
            id="msp-org-website"
            label="Organization Website"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            disabled={isSaving}
            placeholder="www.example.com"
          />
        </div>

        <div className="w-full min-w-0 flex-1 self-stretch">
          <ImageUploader
            fieldLabel="Organization Logo"
            value={displayImageUrl}
            onChange={logo.upload}
            onRemove={logo.remove}
            loading={logo.isBusy}
            objectFit="cover"
            maxSize={5 * 1024 * 1024}
            label="Upload organization logo"
            description="Click to upload or drag and drop"
            alt={name || 'Organization logo'}
            // Pin height only on desktop, where it aligns with the two-input column on the
            // left. On mobile the columns stack, so let the dropzone use its natural height.
            dropzoneClassName="content-md:h-[148px]"
          />
        </div>
      </div>

      {/* Mark as Complete + Save — aligned to the right, matching the design grid */}
      <div className="flex w-full flex-col gap-[var(--spacing-system-m)] content-md:flex-row content-md:items-center">
        <div className="hidden flex-1 content-md:block" />
        <div className="hidden flex-1 content-md:block" />
        {!completed ? (
          <Button
            variant="outline"
            leftIcon={<CheckCircleIcon className="size-5" />}
            onClick={() => {
              actions.begin('complete');
              onComplete?.();
            }}
            loading={actions.complete.loading}
            disabled={actions.complete.disabled}
            className="w-full content-md:flex-1"
          >
            Mark as Complete
          </Button>
        ) : (
          // Keep the completed step's primary button its own width — don't let it
          // stretch into the removed "Mark as Complete" slot.
          <div className="hidden content-md:block content-md:flex-1" aria-hidden />
        )}
        <Button
          variant="accent"
          onClick={() => {
            actions.begin('primary');
            handleSave();
          }}
          loading={actions.primary.loading}
          disabled={actions.primary.disabled}
          className="w-full content-md:flex-1"
        >
          Save Organization
        </Button>
      </div>
    </div>
  );
}
