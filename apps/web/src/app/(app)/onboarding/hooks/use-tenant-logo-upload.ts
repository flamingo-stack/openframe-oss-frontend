'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { deleteWithAuth, uploadWithAuth } from '@/lib/upload-with-auth';
import { TENANT_IMAGE_ENDPOINT, tenantInfoQueryKeys } from '../../settings/hooks/use-tenant-info';
import type { TenantImage } from '../../settings/types/tenant-info';

/**
 * The tenant logo as an `ImageUploader` sees it: the current image, the busy
 * flag, and the upload / remove handlers that write straight to
 * `TENANT_IMAGE_ENDPOINT` and patch the cached tenant record so every reader of
 * `useTenantInfo` shows the new logo at once.
 *
 * Shared by the two surfaces that edit the organization during onboarding - the
 * Initial Setup card's step and the setup wizard's organization screen - so the
 * upload pipeline is written once.
 */
export function useTenantLogoUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [imageHash, setImageHash] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);

  /** Adopt the tenant record's image - called when the record arrives. */
  const seed = useCallback((image: TenantImage | null | undefined) => {
    setImageUrl(image?.imageUrl ?? undefined);
    setImageHash(image?.hash ?? undefined);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setIsBusy(true);
      try {
        const uploadedUrl = await uploadWithAuth(TENANT_IMAGE_ENDPOINT, file);
        const bust = String(Date.now());
        setImageUrl(uploadedUrl);
        setImageHash(bust);
        queryClient.setQueryData(tenantInfoQueryKeys.all, (prev: { image?: TenantImage | null } | null | undefined) =>
          prev ? { ...prev, image: { imageUrl: uploadedUrl, hash: bust } } : prev,
        );
        toast({ title: 'Upload successful', description: 'Organization logo has been updated', variant: 'success' });
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Failed to upload image',
          variant: 'destructive',
        });
      } finally {
        setIsBusy(false);
      }
    },
    [toast, queryClient],
  );

  const remove = useCallback(async () => {
    setIsBusy(true);
    try {
      await deleteWithAuth(TENANT_IMAGE_ENDPOINT);
      setImageUrl(undefined);
      setImageHash(undefined);
      queryClient.setQueryData(tenantInfoQueryKeys.all, (prev: { image?: TenantImage | null } | null | undefined) =>
        prev ? { ...prev, image: null } : prev,
      );
      toast({ title: 'Delete successful', description: 'Organization logo has been removed', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to remove image',
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  }, [toast, queryClient]);

  return { imageUrl, imageHash, isBusy, seed, upload, remove };
}
