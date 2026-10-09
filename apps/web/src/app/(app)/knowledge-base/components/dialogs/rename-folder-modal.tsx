'use client';

import { Button, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ChangeEvent, type KeyboardEvent, useState } from 'react';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { renameFolderModal_folder$key } from '@/__generated__/renameFolderModal_folder.graphql';
import type { renameFolderModalMutation as RenameFolderModalMutationType } from '@/__generated__/renameFolderModalMutation.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

const renameFolderModalFragment = graphql`
  fragment renameFolderModal_folder on KnowledgeBaseItem {
    id
    name
  }
`;

const renameFolderModalMutation = graphql`
  mutation renameFolderModalMutation($id: ID!, $name: String!) {
    renameFolder(id: $id, name: $name) {
      id
      name
      updatedAt
    }
  }
`;

interface RenameFolderModalProps {
  folder: renameFolderModal_folder$key;
  isOpen: boolean;
  onClose: () => void;
}

export function RenameFolderModal({ folder, isOpen, onClose }: RenameFolderModalProps) {
  const { toast } = useToast();
  const data = useFragment(renameFolderModalFragment, folder);
  const [commit, isInFlight] = useMutation<RenameFolderModalMutationType>(renameFolderModalMutation);
  const [name, setName] = useState(data.name);

  // Re-seeded each time the modal opens, during render rather than in an effect: an
  // effect paints the field with the previous value once before correcting it.
  // Keyed off the open transition alone, so a background refresh of the folder
  // cannot overwrite what the user has typed while the modal is up.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setName(data.name);
  }

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== data.name && !isInFlight;

  const handleSubmit = () => {
    if (!canSubmit) return;
    commit({
      variables: { id: data.id, name: trimmed },
      onCompleted: () => {
        toast({ title: 'Folder renamed', description: trimmed, variant: 'success' });
        onClose();
      },
      onError: error => {
        toast({
          title: 'Rename failed',
          description: getRelayErrorMessage(error, 'Unable to rename folder'),
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
      title="Rename Folder"
      contentClassName="flex flex-col gap-[var(--spacing-system-xxs)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isInFlight}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit} loading={isInFlight}>
            Save
          </Button>
        </>
      }
    >
      <Label htmlFor="rename-folder-name" className="text-ods-text-primary text-h4">
        Folder Name
      </Label>
      <Input
        id="rename-folder-name"
        value={name}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter Folder Name"
        disabled={isInFlight}
        autoFocus
      />
    </SimpleModal>
  );
}
