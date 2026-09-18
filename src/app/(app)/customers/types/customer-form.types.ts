import { z } from 'zod';

export const CUSTOMER_NAME_REQUIRED = 'Customer name is required';

/**
 * One contact person on the record. The backend stores four free strings and
 * validates none of them; the rules here are the UI's own. Until the contact
 * rows are editable the list only round-trips, so the schema stays permissive.
 */
export const contactRowSchema = z.object({
  contactName: z.string(),
  title: z.string(),
  email: z.string(),
  phone: z.string(),
});

export type ContactRow = z.infer<typeof contactRowSchema>;

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
