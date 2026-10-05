/**
 * Pins the contact-row rules: nothing required, an empty email passes, a
 * malformed one fails with the copy the toast prints, whitespace is trimmed
 * before any rule runs, and the caps carry their own copy. Each assertion was
 * verified to fail with its guard removed.
 */

import { describe, expect, it } from 'vitest';
import {
  CONTACT_EMAIL_ERROR,
  CONTACT_NAME_MAX,
  contactRowSchema,
  CUSTOMER_FORM_CREATE_DEFAULTS,
  customerFormSchema,
  EMPTY_CONTACT_ROW,
} from './customer-form.types';

describe('contactRowSchema', () => {
  it('accepts a blank row and a row with only a phone number', () => {
    expect(contactRowSchema.safeParse(EMPTY_CONTACT_ROW).success).toBe(true);
    expect(contactRowSchema.safeParse({ ...EMPTY_CONTACT_ROW, phone: '+1 555 0123 ext. 4' }).success).toBe(true);
  });

  it('trims every field and only then checks the email', () => {
    const parsed = contactRowSchema.parse({
      contactName: ' Jane ',
      title: ' IT ',
      email: '  jane@acme.com ',
      phone: ' 1 ',
    });

    expect(parsed).toEqual({ contactName: 'Jane', title: 'IT', email: 'jane@acme.com', phone: '1' });
    expect(contactRowSchema.safeParse({ ...EMPTY_CONTACT_ROW, email: '   ' }).success).toBe(true);
  });

  it('rejects a malformed email with the toast copy on the email path', () => {
    const result = customerFormSchema.safeParse({
      ...CUSTOMER_FORM_CREATE_DEFAULTS,
      name: 'Acme',
      contacts: [{ ...EMPTY_CONTACT_ROW, email: 'john at company dot com' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => [issue.path.join('.'), issue.message])).toEqual([
      ['contacts.0.email', CONTACT_EMAIL_ERROR],
    ]);
  });

  it('caps the length with copy that names the field', () => {
    const result = contactRowSchema.safeParse({ ...EMPTY_CONTACT_ROW, contactName: 'x'.repeat(CONTACT_NAME_MAX + 1) });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(`Keep the contact name under ${CONTACT_NAME_MAX} characters`);
  });
});
