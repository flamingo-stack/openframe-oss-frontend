'use client';

import { Button, TicketAttachmentsList } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { hasNativeFiles, pickNativeFiles } from '@/lib/native-files';
import { formatFileSize } from '../../devices/utils/file-manager-utils';
import { useDownloadTicketAttachment } from '../hooks/use-ticket-attachments';
import { useAddTicketAttachments, useDeleteTicketAttachment } from '../hooks/use-ticket-detail-mutations';
import type { Dialog } from '../types/dialog.types';

interface TicketAttachmentsSectionProps {
  ticketId: string;
  attachments: NonNullable<Dialog['attachments']>;
}

export function TicketAttachmentsSection({ ticketId, attachments }: TicketAttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; fileName: string } | null>(null);
  const { download } = useDownloadTicketAttachment();
  const addAttachments = useAddTicketAttachments(ticketId);
  const deleteAttachment = useDeleteTicketAttachment(ticketId);

  const uiAttachments = attachments.map(att => ({
    id: att.id,
    fileName: att.fileName,
    fileSize: att.fileSize ? formatFileSize(att.fileSize) : '',
    onDownload: () => download(att.id, att.fileName),
    onDelete: () => setPendingDelete({ id: att.id, fileName: att.fileName }),
  }));

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addAttachments.mutate(files);
    e.target.value = '';
  };

  // On mobile the OS picker runs natively, so the upload can stream from a file
  // path instead of a WebView fetch that the bucket's CORS policy would have to
  // allow from capacitor://localhost.
  const addFiles = () => {
    // The web branch must stay on the click handler's synchronous stack: WebKit
    // gates `<input type="file">` activation on the user-gesture stack, which an
    // await does not survive, so awaiting first would deaden this button in
    // Safari and the desktop shell.
    if (!hasNativeFiles()) {
      fileInputRef.current?.click();
      return;
    }
    pickNativeFiles({ multiple: true })
      .then(picked => {
        if (picked?.length) addAttachments.mutate(picked);
      })
      .catch(err => {
        toast({
          title: 'Upload Error',
          description: err instanceof Error ? err.message : 'Could not open the file picker',
          variant: 'destructive',
        });
      });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteAttachment.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
  };

  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <p className="text-h5 text-ods-text-secondary">Attachments</p>
      {uiAttachments.length > 0 && <TicketAttachmentsList attachments={uiAttachments} />}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesSelected} />
      <Button
        variant="outline"
        size="small"
        className="w-fit"
        leftIcon={<Upload />}
        onClick={addFiles}
        disabled={addAttachments.isPending}
      >
        {addAttachments.isPending ? 'Uploading...' : 'Add Files'}
      </Button>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={open => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete Attachment"
        description={`Are you sure you want to delete "${pendingDelete?.fileName ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        variant="destructive"
        isPending={deleteAttachment.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
