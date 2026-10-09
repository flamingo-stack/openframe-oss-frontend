'use client';

import { Button, ImageUploader, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type CreateCustomerRequest, useCreateCustomer } from '@/app/(app)/customers/hooks/use-create-customer';
import { dashboardQueryKeys } from '@/app/(app)/dashboard/utils/query-keys';
import { usePendingLogo } from '@/app/(app)/onboarding/hooks/use-pending-logo';
import { uploadWithAuth } from '@/lib/upload-with-auth';
import { SetupHeading } from '../components/setup-heading';

const emptyAddress = { street1: '', street2: '', city: '', state: '', postalCode: '', country: '' };

type Action = 'test' | 'continue';

/**
 * "Your First Customer": the quick first-client form of the Initial Setup
 * card, without its detour to the Customers page. "Continue" creates the
 * customer (the device step then enrolls into it); "Continue with Test Customer"
 * leaves the workspace's default organization to take the first device.
 */
export function CustomerStep({
  onCreated,
  onTestCustomer,
  persisting,
}: {
  /** A customer exists now; persist the step and enroll the device into it. */
  onCreated: (organizationId: string | null) => void;
  /** No customer: persist the step, the default organization takes the device. */
  onTestCustomer: () => void;
  persisting: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createOrganization } = useCreateCustomer();
  const logo = usePendingLogo();

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const busy = isSubmitting || persisting;

  const handleContinue = async () => {
    if (!name.trim() || busy) return;
    setAction('continue');
    setIsSubmitting(true);
    try {
      const payload: CreateCustomerRequest = {
        name: name.trim(),
        websiteUrl: website.trim() || undefined,
        contactInformation: {
          contacts: [],
          physicalAddress: { ...emptyAddress },
          mailingAddress: { ...emptyAddress },
          mailingAddressSameAsPhysical: true,
        },
      };
      const response = await createOrganization(payload);
      const createdId =
        (response as { organizationId?: string; id?: string } | null)?.organizationId ??
        (response as { id?: string } | null)?.id ??
        null;

      if (createdId && logo.pendingFile) {
        try {
          await uploadWithAuth(`/api/organizations/${createdId}/image`, logo.pendingFile);
        } catch {
          toast({ title: 'Warning', description: 'Customer was created but logo upload failed', variant: 'warning' });
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organizations'] }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
      ]);

      toast({ title: 'Customer created', description: `${name.trim()} has been created`, variant: 'success' });
      onCreated(createdId);
    } catch (error) {
      setAction(null);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save customer',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestCustomer = () => {
    setAction('test');
    onTestCustomer();
  };

  return (
    <>
      <SetupHeading title="Your First Customer" subtitle="Add your first client. Devices need an org to belong to." />
      <div className="flex w-full flex-col gap-[var(--spacing-system-m)]">
        <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2">
          <Input
            id="setup-customer-name"
            label="Customer Name"
            placeholder="TechFlow Solutions"
            value={name}
            onChange={event => setName(event.target.value)}
            disabled={busy}
          />
          <Input
            id="setup-customer-website"
            label="Website URL"
            placeholder="https://www.techflow.com"
            value={website}
            onChange={event => setWebsite(event.target.value)}
            disabled={busy}
          />
        </div>
        <ImageUploader
          value={logo.previewUrl}
          onChange={logo.replace}
          onRemove={() => logo.replace(null)}
          objectFit="contain"
          maxSize={5 * 1024 * 1024}
          label="Upload Logo"
          description="(Click Here or Drag and Drop)"
          alt={name || 'Customer logo'}
        />
        <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2">
          <div className="flex flex-col items-center gap-[var(--spacing-system-xs)]">
            <Button
              variant="outline"
              onClick={handleTestCustomer}
              loading={persisting && action === 'test'}
              disabled={busy}
              className="w-full"
            >
              Continue with Test Customer
            </Button>
            <p className="text-ods-text-secondary text-h6">You can set it up later</p>
          </div>
          <Button
            variant="accent"
            onClick={handleContinue}
            loading={action === 'continue' && busy}
            disabled={!name.trim() || busy}
            className="self-start"
          >
            Continue
          </Button>
        </div>
      </div>
    </>
  );
}
