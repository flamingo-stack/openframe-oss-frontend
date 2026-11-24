import { z } from 'zod';

/**
 * The routing defaults of a mailbox (contract part A, `activateMailbox` / `updateMailbox`): null is "not set", which
 * the API reads as no Default Customer (unknown senders are held), Tech Required, and Unassigned. Every id is the raw
 * one the pickers hold: the API takes a raw id or a Relay id for each.
 */
export const mailboxDefaultsSchema = z.object({
  defaultOrganizationId: z.string().nullable(),
  defaultStatusId: z.string().nullable(),
  defaultAssigneeId: z.string().nullable(),
});

export type MailboxDefaultsFormData = z.infer<typeof mailboxDefaultsSchema>;

export const EMPTY_MAILBOX_DEFAULTS: MailboxDefaultsFormData = {
  defaultOrganizationId: null,
  defaultStatusId: null,
  defaultAssigneeId: null,
};
