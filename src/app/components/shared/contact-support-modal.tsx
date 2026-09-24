'use client';

import {
  CHAT_ATTACHMENT_MIME_TYPES,
  ChatAttachmentChipStrip,
  useChatAttachments,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { PlusIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useTicketActions } from '@flamingo-stack/openframe-frontend-core/components/tickets';
import { Button, Input, Label, Textarea } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { SimpleModal } from './simple-modal';

interface ContactSupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The lib's own cap on ticket body text. Its barrel does not export the constant. */
const MESSAGE_MAX_CHARS = 5000;
/** Matches the subject cap the lib's own ticket forms impose. */
const SUBJECT_MAX_CHARS = 200;
/** Shows the counter only once the message is long enough for the cap to matter. */
const COUNTER_VISIBLE_AT = Math.floor(MESSAGE_MAX_CHARS * 0.8);

/** `useTicketActions` drives a ticket LIST's optimistic cache. This modal has no list. */
const noop = () => {};

/**
 * "Open a New Ticket" — the support ticket form, as a modal.
 *
 * The ticket lands in HubSpot through the SAME path the Help Center's own form
 * uses: `useTicketActions().submitTicket` → `/api/chat/agent/ticket-action`,
 * carrying the session via `embedAuthedFetch`. Nothing about it is
 * lock-screen-specific — that is the point, since the lock screen is exactly
 * where the user has no Help Center to walk to.
 *
 * The three list-cache callbacks the hook takes are no-ops here. They exist to
 * place and retire an optimistic row while HubSpot's mirror catches up; there is
 * no row to place, and the hook still toasts the outcome itself, which is the
 * only feedback this surface needs.
 *
 * Reachable on a locked workspace on purpose: it talks to the content gateway
 * over `embedAuthedFetch`, not to the app's Relay endpoint, so the subscription
 * gate (`lib/subscription-gate.ts`) never parks it.
 *
 * Attachments reuse the chat composer's upload pipeline (`useChatAttachments` —
 * magic-byte sniff, signed PUT, per-file progress). Only the TRIGGER is ours:
 * the lib's `ChatAttachmentAddButton` is a bare `+` glyph for a chat composer,
 * and the design here calls for a labelled control.
 */
export function ContactSupportModal({ open, onOpenChange }: ContactSupportModalProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [supportSystemDown, setSupportSystemDown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { attachments, readyAttachments, hasInflightUploads, addFiles, removeAttachment, clear } = useChatAttachments();

  const markSupportSystemDown = useCallback(() => setSupportSystemDown(true), []);
  const { submitTicket, isSubmittingForm } = useTicketActions({
    prependOptimistic: noop,
    removeOptimistic: noop,
    removeTicketFromCache: noop,
    toast,
    onSupportSystemDown: markSupportSystemDown,
  });

  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();
  const overCap = message.length > MESSAGE_MAX_CHARS;
  const canSubmit =
    !isSubmittingForm &&
    !supportSystemDown &&
    !hasInflightUploads &&
    !overCap &&
    trimmedSubject.length > 0 &&
    trimmedMessage.length > 0;

  const reset = useCallback(() => {
    setSubject('');
    setMessage('');
    clear();
  }, [clear]);

  const handleClose = useCallback(() => {
    if (isSubmittingForm) return;
    onOpenChange(false);
  }, [isSubmittingForm, onOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const sent = await submitTicket({
      subject: trimmedSubject,
      content: trimmedMessage,
      attachments: readyAttachments,
    });
    // `submitTicket` toasts both outcomes itself. A failure keeps the draft on
    // screen — retyping a support request is the last thing a locked-out user
    // should have to do.
    if (sent) {
      reset();
      onOpenChange(false);
    }
  }, [canSubmit, onOpenChange, readyAttachments, reset, submitTicket, trimmedMessage, trimmedSubject]);

  const handleFilesPicked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      if (input.files?.length) addFiles(input.files);
      // Cleared so picking the SAME file again still fires `change`.
      input.value = '';
    },
    [addFiles],
  );

  return (
    <SimpleModal
      isOpen={open}
      onClose={handleClose}
      className="md:max-w-[600px]"
      title="Open a New Ticket"
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          {/* The design's empty half — the submit occupies the right column. */}
          <div className="hidden flex-1 sm:block" />
          <Button
            type="button"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmittingForm}
          >
            Open Ticket
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <Label htmlFor="support-ticket-subject">Subject</Label>
        <Input
          id="support-ticket-subject"
          value={subject}
          onChange={event => setSubject(event.target.value)}
          placeholder="Briefly describe what's going on"
          maxLength={SUBJECT_MAX_CHARS}
          disabled={isSubmittingForm || supportSystemDown}
        />
      </div>

      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <Label htmlFor="support-ticket-message">Your Message</Label>
        <Textarea
          id="support-ticket-message"
          value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder="Share your current challenges or questions..."
          rows={4}
          className="resize-none"
          disabled={isSubmittingForm || supportSystemDown}
        />
        {message.length >= COUNTER_VISIBLE_AT && (
          <p className={`text-right text-h6 ${overCap ? 'text-ods-error' : 'text-ods-text-secondary'}`}>
            {message.length}/{MESSAGE_MAX_CHARS}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start gap-[var(--spacing-system-xsf)]">
        <ChatAttachmentChipStrip
          attachments={attachments}
          onRemove={removeAttachment}
          disabled={isSubmittingForm || supportSystemDown}
        />
        <Button
          type="button"
          variant="outline"
          size="small"
          // The design's 16px glyph; the button's base sizes every icon at 20px.
          className="[&_svg]:size-4"
          leftIcon={<PlusIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isSubmittingForm || supportSystemDown}
        >
          Attach Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={CHAT_ATTACHMENT_MIME_TYPES.join(',')}
          className="hidden"
          onChange={handleFilesPicked}
        />
      </div>

      {supportSystemDown && (
        <p className="text-ods-error text-h6">Support system temporarily unavailable. Please try again shortly.</p>
      )}
    </SimpleModal>
  );
}
