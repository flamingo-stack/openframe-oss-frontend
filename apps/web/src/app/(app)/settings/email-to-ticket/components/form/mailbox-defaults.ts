import { graphql, readInlineData } from 'react-relay';
import { z } from 'zod';
import type { mailboxDefaults_mailbox$key } from '@/__generated__/mailboxDefaults_mailbox.graphql';
import type { StatusOption } from '@/app/(app)/tickets/components/status-autocomplete';
import type { AvatarOption } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { getFullImageUrl } from '@/lib/image-url';
import { rawIdOfType } from '@/lib/relay-id';
import { blockListRowsSchema } from '../../utils/block-list-rows';

/**
 * A mailbox's settings form. The routing defaults (contract part A, `activateMailbox` / `updateMailbox`): null is "not
 * set", which the API reads as no Default Customer (unknown senders are held), Tech Required, and Unassigned. Every id
 * is the raw one the pickers hold: the API takes a raw id or a Relay id for each. The Block list rows (part D): sent with
 * Save Mailbox of a new mailbox.
 */
export const mailboxSettingsSchema = z.object({
  defaultOrganizationId: z.string().nullable(),
  defaultStatusId: z.string().nullable(),
  defaultAssigneeId: z.string().nullable(),
  blockList: blockListRowsSchema,
});

export type MailboxSettingsFormData = z.infer<typeof mailboxSettingsSchema>;

/** The routing defaults alone: what `updateMailbox` replaces. */
export type MailboxDefaultsValues = Pick<
  MailboxSettingsFormData,
  'defaultOrganizationId' | 'defaultStatusId' | 'defaultAssigneeId'
>;

export const EMPTY_MAILBOX_SETTINGS: MailboxSettingsFormData = {
  defaultOrganizationId: null,
  defaultStatusId: null,
  defaultAssigneeId: null,
  blockList: [],
};

/** The routing defaults of a settings form, without its Block list rows. */
export function mailboxDefaultsValues({
  defaultOrganizationId,
  defaultStatusId,
  defaultAssigneeId,
}: MailboxSettingsFormData): MailboxDefaultsValues {
  return { defaultOrganizationId, defaultStatusId, defaultAssigneeId };
}

export const mailboxDefaultsFragment = graphql`
  fragment mailboxDefaults_mailbox on Mailbox @inline {
    defaultOrganization {
      organizationId
      name
      image {
        imageUrl
        hash
      }
    }
    defaultStatus {
      id
      name
      color
    }
    defaultAssignee {
      ...userSummaryFields_user
    }
  }
`;

/**
 * The saved customer and status as picker options: the form holds their ids from its first render, before the
 * pickers' own options arrive (and a page of customers may not hold the saved one).
 */
/**
 * A ticket status's id as the Default Status picker holds it. The statuses list (ai-agent) and a mailbox's
 * `defaultStatus` (api) spell one status's id differently (a Relay id, a raw id), and a picker that compared the two
 * listed the saved status twice. The API takes either.
 */
export function statusPickerId(id: string): string {
  return rawIdOfType('TicketStatusDefinition', id);
}

export interface StoredDefaultOptions {
  customer: AvatarOption | null;
  status: StatusOption | null;
}

/** A saved mailbox's defaults: the form's values and the options that keep their labels. */
export function toStoredDefaults(ref: mailboxDefaults_mailbox$key): {
  values: MailboxSettingsFormData;
  options: StoredDefaultOptions;
} {
  const {
    defaultOrganization: customer,
    defaultStatus: status,
    defaultAssignee,
  } = readInlineData(mailboxDefaultsFragment, ref);
  const statusOption = status ? { value: statusPickerId(status.id), label: status.name, color: status.color } : null;
  return {
    values: {
      defaultOrganizationId: customer?.organizationId ?? null,
      defaultStatusId: statusOption?.value ?? null,
      defaultAssigneeId: defaultAssignee ? toUserSummary(defaultAssignee).rawId : null,
      blockList: [],
    },
    options: {
      customer: customer
        ? {
            value: customer.organizationId,
            label: customer.name,
            imageUrl: getFullImageUrl(customer.image?.imageUrl, customer.image?.hash),
          }
        : null,
      status: statusOption,
    },
  };
}
