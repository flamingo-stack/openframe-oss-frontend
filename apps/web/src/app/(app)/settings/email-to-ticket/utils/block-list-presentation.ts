// What the Block list says on screen (Figma settings 6236-119872, 6236-120311).

import { EmailBlockListEntryKind } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { pluralNoun } from '@/lib/pluralize';

/** The section's heading, the same on New Mailbox, Edit Mailbox and the details page. */
export const BLOCK_LIST_HEADING = {
  title: 'Block List',
  description: 'Emails from these addresses and domains are dropped. They never become tickets.',
} as const;

const KIND_LABEL = {
  [EmailBlockListEntryKind.ADDRESS]: 'Address',
  [EmailBlockListEntryKind.DOMAIN]: 'Domain',
} satisfies Record<EmailBlockListEntryKind, string>;

/** Beside a blocked value: an address or a whole domain. */
export function blockListKindLabel(kind: string): string {
  return presentationFor(KIND_LABEL, kind) ?? '';
}

/** DROPPED FOR 30 DAYS: "6 emails". */
export function blockListDroppedLabel(count: number): string {
  return `${count} ${pluralNoun(count, 'email')}`;
}
