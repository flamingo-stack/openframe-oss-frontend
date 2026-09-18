'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { deleteWithAuth, uploadWithAuth } from '@/lib/upload-with-auth';
import { invalidateCustomerQueries } from '../utils/invalidate-customer-queries';
import { useCustomerDetails } from './use-customer-details';

interface StoredCustomerLogo {
  imageUrl?: string | null;
  imageHash?: string | null;
}

interface UseCustomerLogoOptions {
  organizationId: string | null;
}

const logoEndpoint = (organizationId: string) => `/api/organizations/${organizationId}/image`;

/**
 * The customer logo lives outside the form fields: in edit mode an upload or a
 * delete persists immediately, independent of Save; on create the file waits in
 * memory until the record exists (`flushPendingUpload`). `override` is what this
 * session uploaded or deleted — it wins over the record until the refetch
 * catches up, so fresh bytes show at once and a deleted logo does not reappear
 * from the cache.
 */
export function useCustomerLogo({ organizationId }: UseCustomerLogoOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // The record's own logo (edit mode); the same query the form hook observes.
  const { organization } = useCustomerDetails(organizationId);
  const stored: StoredCustomerLogo | null = organization
    ? { imageUrl: organization.imageUrl, imageHash: organization.imageHash }
    : null;

  const [override, setOverride] = useState<StoredCustomerLogo | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | undefined>(undefined);
  const previewUrlRef = useRef<string | undefined>(undefined);

  // Revoke the preview blob on unmount
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const current = override ?? stored;
  const displayedImage = pendingPreviewUrl || getFullImageUrl(current?.imageUrl, current?.imageHash);

  const replacePendingPreview = (file: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (file) {
      const next = URL.createObjectURL(file);
      previewUrlRef.current = next;
      setPendingPreviewUrl(next);
    } else {
      previewUrlRef.current = undefined;
      setPendingPreviewUrl(undefined);
    }
    setPendingFile(file);
  };

  const handleImageChange = async (file: File) => {
    if (!organizationId) {
      replacePendingPreview(file);
      return;
    }
    try {
      const uploadedUrl = await uploadWithAuth(logoEndpoint(organizationId), file);
      // The image path is stable across uploads, so bust the cache with the
      // upload time — otherwise the uploader keeps showing the old bytes.
      setOverride({ imageUrl: uploadedUrl, imageHash: String(Date.now()) });
      // The image persists immediately (independent of Save), so refresh the
      // cached org lists that render this logo with its hash elsewhere.
      await invalidateCustomerQueries(queryClient, organizationId);
      toast({
        title: 'Upload successful',
        description: 'Customer image has been updated',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: 'destructive',
      });
    }
  };

  const handleImageRemove = async () => {
    if (!organizationId || !current?.imageUrl) {
      replacePendingPreview(null);
      return;
    }
    try {
      await deleteWithAuth(logoEndpoint(organizationId));
      setOverride({ imageUrl: undefined, imageHash: undefined });
      await invalidateCustomerQueries(queryClient, organizationId);
      toast({
        title: 'Delete successful',
        description: 'Customer image has been deleted',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  /** Create mode: upload the file picked before the record existed. A failure is a warning — the customer is saved. */
  const flushPendingUpload = async (createdOrganizationId: string) => {
    if (!pendingFile) return;
    try {
      await uploadWithAuth(logoEndpoint(createdOrganizationId), pendingFile);
    } catch {
      toast({
        title: 'Warning',
        description: 'Customer was created but logo upload failed',
        variant: 'warning',
      });
    }
  };

  return { displayedImage, handleImageChange, handleImageRemove, flushPendingUpload };
}
