'use client';

import {
  CHAT_ATTACHMENT_MIME_TYPES,
  ChatAttachmentChipStrip,
  useChatAttachments,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { PlusIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useTicketActions } from '@flamingo-stack/openframe-frontend-core/components/tickets';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TabSelector,
  Textarea,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ChangeEvent, type ReactNode, useCallback, useRef, useState } from 'react';
import { BillingCallBack } from './billing-call-back';
import { noop } from './no-next-page';
import { SimpleModal } from './simple-modal';

interface ContactSupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The modal's heading. Defaults to "Contact Support". */
  title?: string;
  /** The submit button's label. Defaults to "Send". */
  submitLabel?: string;
  /** When set, a Cancel button with this label leads the footer on phones. */
  cancelLabel?: string;
  /**
   * The subject as a pick list instead of free text. Its last entry, when it is
   * {@link OTHER_SUBJECT}, reveals the free-text field; the pick (or that text) is
   * sent as the ticket's subject.
   */
  subjects?: readonly string[];
  /** A line under the form, over the submit (the billing modal's email fallback). */
  footnote?: ReactNode;
  /** A second tab, "Call Me Back", drawn in place of the form; it brings its own footer. */
  callBack?: (close: () => void) => ReactNode;
}

/** The pick-list entry that asks for the subject in the user's own words. */
export const OTHER_SUBJECT = 'Other';

type SupportTab = 'ticket' | 'call';

const SUPPORT_TABS: { id: SupportTab; label: string }[] = [
  { id: 'ticket', label: 'Support Ticket' },
  { id: 'call', label: 'Call Me Back' },
];

/** The lib's own cap on ticket body text. Its barrel does not export the constant. */
const MESSAGE_MAX_CHARS = 5000;
/** Matches the subject cap the lib's own ticket forms impose. */
const SUBJECT_MAX_CHARS = 200;
/** Shows the counter only once the message is long enough for the cap to matter. */
const COUNTER_VISIBLE_AT = Math.floor(MESSAGE_MAX_CHARS * 0.8);

/**
 * "Contact Support" — the support ticket form, as a modal.
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
export function ContactSupportModal({
  open,
  onOpenChange,
  title = 'Contact Support',
  submitLabel = 'Send',
  cancelLabel,
  subjects,
  footnote,
  callBack,
}: ContactSupportModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<SupportTab>('ticket');
  const [subjectPick, setSubjectPick] = useState('');
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

  // A pick is the subject itself, except Other, which is the text typed under it.
  const typesSubject = !subjects || subjectPick === OTHER_SUBJECT;
  const trimmedSubject = typesSubject ? subject.trim() : subjectPick;
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
    setSubjectPick('');
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

  const formDisabled = isSubmittingForm || supportSystemDown;
  const showsCallBack = callBack != null && tab === 'call';

  return (
    <SimpleModal
      isOpen={open}
      onClose={handleClose}
      className="md:max-w-[600px]"
      title={title}
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        // The scheduler draws its own Continue under the calendar.
        !showsCallBack && (
          <>
            {/* The design's empty half — the submit occupies the right column. On a
              phone the wizard's design fills it with a Cancel instead. */}
            {cancelLabel ? (
              <Button type="button" variant="outline" className="flex-1 sm:hidden" onClick={handleClose}>
                {cancelLabel}
              </Button>
            ) : null}
            <div className="hidden flex-1 sm:block" />
            <Button
              type="button"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmittingForm}
            >
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      {callBack && (
        <TabSelector
          value={tab}
          onValueChange={value => setTab(value as SupportTab)}
          items={SUPPORT_TABS}
          disabled={isSubmittingForm}
        />
      )}

      {showsCallBack ? (
        callBack(() => onOpenChange(false))
      ) : (
        <>
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            {subjects ? (
              <Select value={subjectPick} onValueChange={setSubjectPick} disabled={formDisabled}>
                <SelectTrigger id="support-ticket-subject-pick" label="Subject" labelVariant="large">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Label variant="large" htmlFor="support-ticket-subject">
                Subject
              </Label>
            )}
            {typesSubject && (
              <Input
                id="support-ticket-subject"
                aria-label={subjects ? 'Describe the subject' : undefined}
                value={subject}
                onChange={event => setSubject(event.target.value)}
                placeholder="Briefly describe what's going on"
                maxLength={SUBJECT_MAX_CHARS}
                disabled={formDisabled}
              />
            )}
          </div>

          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <Label variant="large" htmlFor="support-ticket-message">
              Your Message
            </Label>
            <Textarea
              id="support-ticket-message"
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="Share your current challenges or questions..."
              rows={4}
              className="resize-none"
              disabled={formDisabled}
            />
            {message.length >= COUNTER_VISIBLE_AT && (
              <p className={`text-right text-h6 ${overCap ? 'text-ods-error' : 'text-ods-text-secondary'}`}>
                {message.length}/{MESSAGE_MAX_CHARS}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-[var(--spacing-system-xsf)]">
            <ChatAttachmentChipStrip attachments={attachments} onRemove={removeAttachment} disabled={formDisabled} />
            <Button
              type="button"
              variant="outline"
              size="small"
              // The design's 16px glyph; the button's base sizes every icon at 20px.
              className="[&_svg]:size-4"
              leftIcon={<PlusIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={formDisabled}
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
        </>
      )}

      {footnote && <div className="mt-auto">{footnote}</div>}
    </SimpleModal>
  );
}

/** The billing subjects the lock screen's support form offers (design 2653:142080). */
const BILLING_SUBJECTS = [
  'Invoice looks wrong',
  "I've already paid",
  'Update billing contact',
  'We need more time',
  OTHER_SUBJECT,
] as const;

const BILLING_EMAIL = 'support@flamingo.run';

/**
 * Contact Support as the lock screens open it: billing subjects, the call-back
 * tab and the email fallback (designs 2641:54555, 2653:142746).
 */
export function BillingContactSupportModal({
  open,
  onOpenChange,
}: Pick<ContactSupportModalProps, 'open' | 'onOpenChange'>) {
  return (
    <ContactSupportModal
      open={open}
      onOpenChange={onOpenChange}
      subjects={BILLING_SUBJECTS}
      callBack={close => <BillingCallBack onDone={close} />}
      footnote={
        <p className="text-ods-text-secondary text-h4">
          Prefer email? We reply within 24 hours.{' '}
          <a href={`mailto:${BILLING_EMAIL}`} className="text-ods-text-primary underline underline-offset-2">
            {BILLING_EMAIL}
          </a>
          .
        </p>
      }
    />
  );
}
