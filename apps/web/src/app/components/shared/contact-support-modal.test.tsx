/**
 * Contact Support's subject: a pick from the billing list is the subject itself, except
 * Other, which asks for it in the user's words; "Call Me Back" replaces the form (CU-17tkuw61dcb).
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingContactSupportModal, ContactSupportModal } from './contact-support-modal';

const submitTicket = vi.fn(async (_ticket: { subject: string; content: string }) => true);

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/tickets', () => ({
  useTicketActions: () => ({ submitTicket, isSubmittingForm: false }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  CHAT_ATTACHMENT_MIME_TYPES: [],
  ChatAttachmentChipStrip: () => null,
  useChatAttachments: () => ({
    attachments: [],
    readyAttachments: [],
    hasInflightUploads: false,
    addFiles: () => {},
    removeAttachment: () => {},
    clear: () => {},
  }),
}));
// Radix Select does not open in jsdom: a native select with the same value contract.
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select aria-label="Subject" value={value} onChange={event => onValueChange(event.target.value)}>
      <option value="">Select Subject</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));
vi.mock('./simple-modal', () => ({
  SimpleModal: ({ title, footer, children }: { title: ReactNode; footer: ReactNode; children: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock('./billing-call-back', () => ({
  BillingCallBack: ({ onDone }: { onDone: () => void }) => (
    <button type="button" onClick={onDone}>
      Book
    </button>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  submitTicket.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label) as HTMLButtonElement | undefined;

function type(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = Object.getPrototypeOf(element) as object;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value);
  act(() => {
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

const subjectInput = () => container.querySelector<HTMLInputElement>('#support-ticket-subject');
const messageInput = () => container.querySelector<HTMLTextAreaElement>('#support-ticket-message');
const subjectPick = () => container.querySelector<HTMLSelectElement>('select[aria-label="Subject"]');

async function send() {
  await act(async () => button('Send')?.click());
}

describe('BillingContactSupportModal', () => {
  beforeEach(() => {
    act(() => root.render(<BillingContactSupportModal open onOpenChange={() => {}} />));
  });

  it('sends the picked subject as the ticket subject', async () => {
    expect(subjectInput()).toBeNull();
    const pick = subjectPick();
    if (!pick) throw new Error('no subject select');
    type(pick, "I've already paid");
    const message = messageInput();
    if (!message) throw new Error('no message field');
    type(message, 'Paid on the 1st');

    await send();

    expect(submitTicket).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "I've already paid", content: 'Paid on the 1st' }),
    );
  });

  it('asks for the subject in words once Other is picked, and sends that text', async () => {
    const pick = subjectPick();
    if (!pick) throw new Error('no subject select');
    type(pick, 'Other');
    const message = messageInput();
    if (!message) throw new Error('no message field');
    type(message, 'Help');
    expect(button('Send')?.disabled).toBe(true);

    const subject = subjectInput();
    if (!subject) throw new Error('Other did not reveal the subject field');
    type(subject, '  Card was charged twice  ');
    await send();

    expect(submitTicket).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Card was charged twice' }));
  });

  it('shows the email fallback', () => {
    expect(container.querySelector('a[href="mailto:support@flamingo.run"]')).not.toBeNull();
  });
});

describe('ContactSupportModal', () => {
  it('without a subject list, takes the subject as free text', async () => {
    act(() => root.render(<ContactSupportModal open onOpenChange={() => {}} />));
    expect(container.querySelector('h2')?.textContent).toBe('Contact Support');
    expect(subjectPick()).toBeNull();

    const subject = subjectInput();
    const message = messageInput();
    if (!subject || !message) throw new Error('form fields missing');
    type(subject, 'Login');
    type(message, 'Cannot sign in');
    await send();

    expect(submitTicket).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Login' }));
  });

  it('draws the call-back in place of the form, and its close closes the modal', () => {
    const onOpenChange = vi.fn();
    act(() => root.render(<BillingContactSupportModal open onOpenChange={onOpenChange} />));

    act(() => button('Call Me Back')?.click());
    expect(messageInput()).toBeNull();
    expect(button('Send')).toBeUndefined();

    act(() => button('Book')?.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
