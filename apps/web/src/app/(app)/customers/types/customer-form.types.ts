import { z } from 'zod';

export const CUSTOMER_NAME_REQUIRED = 'Customer name is required';

/**
 * UI sanity caps for a contact row. The backend stores four free strings and
 * validates none of them, so these numbers are the form's own: a person's name
 * or job title never legitimately exceeds 100, 254 is the practical maximum for
 * a full email address, and 32 leaves E.164 (15 digits) room for "+", spaces,
 * brackets and an extension.
 */
export const CONTACT_NAME_MAX = 100;
export const CONTACT_TITLE_MAX = 100;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_PHONE_MAX = 32;

export const CONTACT_EMAIL_ERROR = 'Enter a valid email address, e.g. name@company.com';

/** The one place the four contact fields are named — the form and the Details card read it. */
export const CONTACT_FIELD_LABELS = {
  contactName: 'Contact Name',
  title: 'Contact Title',
  email: 'Email Address',
  phone: 'Phone Number',
} as const;

const contactText = (max: number, label: string) =>
  z.string().trim().max(max, `Keep the ${label} under ${max} characters`);

const emailSchema = z.email();

/**
 * One contact person. Nothing is required — a row with only a phone number is
 * a contact — and an empty email means "not provided"; only a non-empty one is
 * format-checked. Phone stays free-form on purpose (international formats,
 * extensions). Whitespace is trimmed on the way out.
 */
export const contactRowSchema = z.object({
  contactName: contactText(CONTACT_NAME_MAX, 'contact name'),
  title: contactText(CONTACT_TITLE_MAX, 'contact title'),
  email: contactText(CONTACT_EMAIL_MAX, 'email').refine(
    value => value === '' || emailSchema.safeParse(value).success,
    CONTACT_EMAIL_ERROR,
  ),
  phone: contactText(CONTACT_PHONE_MAX, 'phone number'),
});

export type ContactRow = z.infer<typeof contactRowSchema>;

export const EMPTY_CONTACT_ROW: ContactRow = { contactName: '', title: '', email: '', phone: '' };

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, CUSTOMER_NAME_REQUIRED),
  website: z.string().trim(),
  // Notes and the address lines are sent as typed — surrounding whitespace included — as they always were.
  notes: z.string(),
  physicalAddress: z.string(),
  mailingAddress: z.string(),
  mailingSameAsPhysical: z.boolean(),
  contacts: z.array(contactRowSchema),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export const CUSTOMER_FORM_DEFAULT_VALUES: CustomerFormData = {
  name: '',
  website: '',
  notes: '',
  physicalAddress: '',
  mailingAddress: '',
  mailingSameAsPhysical: true,
  contacts: [],
};

/** A new customer starts with one empty contact row so the inputs are visible up front; a blank row is dropped on submit. */
export const CUSTOMER_FORM_CREATE_DEFAULTS: CustomerFormData = {
  ...CUSTOMER_FORM_DEFAULT_VALUES,
  contacts: [EMPTY_CONTACT_ROW],
};
