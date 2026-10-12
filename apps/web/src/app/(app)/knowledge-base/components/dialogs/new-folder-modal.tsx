'use client';

import { Button, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ChangeEvent, type KeyboardEvent, useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { newFolderModalMutation as NewFolderModalMutationType } from '@/__generated__/newFolderModalMutation.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { addToFolderTree, invalidateFolderListing } from '../shared/knowledge-base-listings';

// `name` and `parentId` are what the folder pickers read off the folder tree.
const newFolderModalMutation = graphql`
  mutation newFolderModalMutation($name: String!, $parentId: ID) {
    createFolder(name: $name, parentId: $parentId) {
      id
      name
      parentId
    }
  }
`;

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The folder the new one is created in; null is the root. */
  parentId: string | null;
}

export function NewFolderModal({ isOpen, onClose, parentId }: NewFolderModalProps) {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<NewFolderModalMutationType>(newFolderModalMutation);
  const [name, setName] = useState('');

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old value on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setName('');
  }

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !isInFlight;

  const handleSubmit = () => {
    if (!canSubmit) return;
    commit({
      variables: { name: trimmed, parentId },
      updater: store => {
        addToFolderTree(store, store.getRootField('createFolder'));
        invalidateFolderListing(store, parentId);
      },
      onCompleted: () => {
        toast({ title: 'Folder created', description: trimmed, variant: 'success' });
        onClose();
      },
      onError: error => {
        toast({
          title: 'Create folder failed',
          description: getRelayErrorMessage(error, 'Unable to create folder'),
          variant: 'destructive',
        });
      },
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSubmit) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title="New Folder"
      contentClassName="flex flex-col gap-[var(--spacing-system-xxs)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isInFlight}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit} loading={isInFlight}>
            Create Folder
          </Button>
        </>
      }
    >
      <Label htmlFor="new-folder-name" className="text-ods-text-primary text-h4">
        Folder Name
      </Label>
      <Input
        id="new-folder-name"
        value={name}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter Folder Name Here"
        disabled={isInFlight}
        autoFocus
      />
    </SimpleModal>
  );
}
