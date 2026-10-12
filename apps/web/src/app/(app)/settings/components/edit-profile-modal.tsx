'use client';

import { Button, Input, Label } from '@flamingo-stack/openframe-frontend-core';
import { ImageUploader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { commitLocalUpdate, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { editProfileModalMutation } from '@/__generated__/editProfileModalMutation.graphql';
import type { User } from '@/app/(auth)/auth/stores';
import { useAuthStore } from '@/app/(auth)/auth/stores';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { getFullImageUrl } from '@/lib/image-url';
import { toGlobalId } from '@/lib/relay-id';
import { deleteWithAuth, uploadWithAuth } from '@/lib/upload-with-auth';

const editProfileModalMutationNode = graphql`
  mutation editProfileModalMutation($input: UpdateUserInput!) {
    updateUser(input: $input) {
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The signed-in user: this modal edits only your own profile. */
  user: User | null;
}

export function EditProfileModal({ isOpen, onClose, user }: EditProfileModalProps) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const updateUser = useAuthStore(state => state.updateUser);
  const [commit, isSaving] = useMutation<editProfileModalMutation>(editProfileModalMutationNode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [imageHash, setImageHash] = useState<string | undefined>();
  const [isImageBusy, setIsImageBusy] = useState(false);

  // Seeded on the open transition, during render rather than in an effect: an
  // effect paints the previous values once before correcting them, and keying off
  // the transition alone means a background refresh of the source can no longer
  // overwrite what the user has typed while the modal is up.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setImageUrl(user.image?.imageUrl);
      setImageHash(user.image?.hash);
    }
  }

  /**
   * The avatar is uploaded over REST (multipart), so the `User` in the Relay store
   * is told by hand — the users row and the employee page draw from it.
   */
  const storeImage = (image: { imageUrl: string; hash: string } | null) => {
    if (!user?.id) return;
    const userId = toGlobalId('User', user.id);
    commitLocalUpdate(environment, store => {
      const record = store.get(userId);
      if (!record) return;
      if (!image) {
        record.setValue(null, 'image');
        return;
      }
      const imageRecord = record.getOrCreateLinkedRecord('image', 'UserImage');
      imageRecord.setValue(image.imageUrl, 'imageUrl');
      imageRecord.setValue(image.hash, 'hash');
    });
  };

  const handleImageChange = async (file: File) => {
    setIsImageBusy(true);
    try {
      const uploadedUrl = await uploadWithAuth('/api/users/image', file);
      // The image path is stable across uploads, so push the new URL with a
      // fresh cache-bust into the auth store, the Relay store and the modal
      // preview — this updates every avatar render site (header, profile card,
      // users row, this uploader) immediately, without a stale-read race on a
      // separate profile read.
      const bust = String(Date.now());
      setImageUrl(uploadedUrl);
      setImageHash(bust);
      updateUser({ image: { imageUrl: uploadedUrl, hash: bust } });
      storeImage({ imageUrl: uploadedUrl, hash: bust });
      toast({ title: 'Upload successful', description: 'Profile image has been updated', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsImageBusy(false);
    }
  };

  const handleImageRemove = async () => {
    setIsImageBusy(true);
    try {
      await deleteWithAuth('/api/users/image');
      setImageUrl(undefined);
      setImageHash(undefined);
      updateUser({ image: undefined });
      storeImage(null);
      toast({ title: 'Delete successful', description: 'Profile image has been removed', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to remove image',
        variant: 'destructive',
      });
    } finally {
      setIsImageBusy(false);
    }
  };

  const handleSave = () => {
    if (!user?.id) return;
    commit({
      variables: { input: { id: toGlobalId('User', user.id), firstName, lastName } },
      onCompleted: ({ updateUser: { user: saved } }) => {
        updateUser({ firstName: saved.firstName ?? '', lastName: saved.lastName ?? '' });
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been updated successfully.',
          variant: 'success',
          duration: 3000,
        });
        onClose();
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to update profile'),
          variant: 'destructive',
        });
      },
    });
  };

  const primaryRole = user?.roles?.[0] || 'User';
  const displayImageUrl = getFullImageUrl(imageUrl, imageHash);

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title="Edit Profile"
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="h-12 flex-1 border-ods-border bg-ods-card text-ods-text-primary text-h3 hover:bg-ods-bg"
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleSave}
            disabled={isSaving}
            className="h-12 flex-1 bg-ods-accent text-ods-text-on-accent text-h3 hover:bg-ods-accent/90"
          >
            {isSaving ? 'Saving...' : 'Update Profile'}
          </Button>
        </>
      }
    >
      <ImageUploader
        value={displayImageUrl}
        onChange={handleImageChange}
        onRemove={handleImageRemove}
        loading={isImageBusy}
        objectFit="cover"
        maxSize={5 * 1024 * 1024}
        label="Upload profile image"
        description="Click to upload or drag and drop"
        alt={[firstName, lastName].filter(Boolean).join(' ') || 'Profile image'}
      />

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <Label htmlFor="edit-firstName" className="text-ods-text-primary text-h4">
            First Name
          </Label>
          <Input
            id="edit-firstName"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            disabled={isSaving}
            placeholder="First name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-lastName" className="text-ods-text-primary text-h4">
            Last Name
          </Label>
          <Input
            id="edit-lastName"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            disabled={isSaving}
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <Label className="text-ods-text-primary text-h4">Email</Label>
          <Input id="edit-email" value={user?.email || ''} disabled placeholder="Email" />
        </div>
        <div className="space-y-1">
          <Label className="text-ods-text-primary text-h4">Role</Label>
          <Input id="edit-roles" value={primaryRole} disabled placeholder="Role" />
        </div>
      </div>
    </SimpleModal>
  );
}
