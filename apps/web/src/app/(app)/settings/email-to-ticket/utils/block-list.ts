// A mailbox's Block list (contract part D): addresses and domains whose emails are dropped. The server owns the rules
// and says why it refuses a value (`EMAIL_BLOCK_LIST_*` user errors); the form checks the same rules first, so a typo is
// marked on its row before Save instead of failing the whole save.

import { z } from 'zod';
import { EmailBlockListEntryKind } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { pluralNoun } from '@/lib/pluralize';

/** What the server trims off both ends besides whitespace: NBSP, zero-width space, BOM. */
const EDGE_CHARACTERS = /^[\s\u00a0\u200b\ufeff]+|[\s\u00a0\u200b\ufeff]+$/g;
/** Printable ASCII without the space; `*` and `?` are refused (no wildcards). */
const ALLOWED = /^[\x21-\x7e]+$/;
const WILDCARD = /[*?]/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export const BLOCK_LIST_ADDRESS_MAX = 254;
export const BLOCK_LIST_DOMAIN_MAX = 253;
/** The most values Save Mailbox sends (`activateMailbox.blockList`). */
export const BLOCK_LIST_SAVE_MAX = 500;

/** The value as the server stores it: trimmed and lower-cased. */
export function normalizeBlockListValue(value: string): string {
  return value.replace(EDGE_CHARACTERS, '').toLowerCase();
}

function domainError(domain: string): string | null {
  const labels = domain.split('.');
  if (domain.endsWith('.') || labels.length < 2 || labels.some(label => label === '')) {
    return 'Enter a domain like example.com.';
  }
  if (IPV4.test(domain) || domain.includes(':')) return 'IP addresses cannot be blocked. Enter a domain.';
  return null;
}

/**
 * Why a value cannot be blocked, or null when it can. With `@` it is an address (one `@`, up to 254 characters), without
 * it a domain (two labels at least, no trailing dot, up to 253 characters, no IP address); international names only
 * as punycode. An empty value is not an error here: blank rows are dropped on save.
 */
export function blockListValueError(raw: string): string | null {
  const value = normalizeBlockListValue(raw);
  if (!value) return null;
  if (!ALLOWED.test(value)) return 'Use letters, digits and symbols only. International names go in punycode (xn--).';
  if (WILDCARD.test(value)) return 'Wildcards are not supported. Block the domain instead.';
  if (value.includes('@')) {
    const parts = value.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return 'Enter an address like name@example.com.';
    if (value.length > BLOCK_LIST_ADDRESS_MAX) return `An address is at most ${BLOCK_LIST_ADDRESS_MAX} characters.`;
    return domainError(parts[1]);
  }
  if (value.length > BLOCK_LIST_DOMAIN_MAX) return `A domain is at most ${BLOCK_LIST_DOMAIN_MAX} characters.`;
  return domainError(value);
}

export interface BlockListRow {
  value: string;
  /** The stored entry the row shows (Edit Mailbox); none for a row typed on this page. */
  entryId?: string;
}

/** The Block list rows of a form: each row checked, a repeat marked on its second row. */
export const blockListRowsSchema = z
  .array(z.object({ value: z.string(), entryId: z.string().optional() }))
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const message = blockListValueError(row.value);
      if (message) {
        ctx.addIssue({ code: 'custom', message, path: [index, 'value'] });
        return;
      }
      const value = normalizeBlockListValue(row.value);
      if (!value) return;
      if (seen.has(value))
        ctx.addIssue({ code: 'custom', message: 'This sender is already in the list.', path: [index, 'value'] });
      seen.add(value);
    });
  });

/** The values a save sends: normalized, blanks dropped. */
export function blockListValues(rows: readonly BlockListRow[]): string[] {
  return rows.map(row => normalizeBlockListValue(row.value)).filter(Boolean);
}

/**
 * The row a server refusal points at: `blockList.<i>` counts the values Save Mailbox sent (blanks dropped), from zero;
 * the form's row index is that value's position among the non-blank rows.
 */
export function blockListRowOfField(rows: readonly BlockListRow[], field: string | null | undefined): number | null {
  const match = field?.match(/^blockList\.(\d+)$/);
  if (!match) return null;
  const sentIndex = Number(match[1]);
  let seen = -1;
  for (const [index, row] of rows.entries()) {
    if (normalizeBlockListValue(row.value)) seen += 1;
    if (seen === sentIndex) return index;
  }
  return null;
}

const KIND_LABEL = {
  [EmailBlockListEntryKind.ADDRESS]: 'Address',
  [EmailBlockListEntryKind.DOMAIN]: 'Domain',
} satisfies Record<EmailBlockListEntryKind, string>;

/** The line under a blocked value (Figma 4678-121984): an address or a whole domain. */
export function blockListKindLabel(kind: string): string {
  return presentationFor(KIND_LABEL, kind) ?? '';
}

/** DROPPED FOR 30 DAYS: "6 emails". */
export function blockListDroppedLabel(count: number): string {
  return `${count} ${pluralNoun(count, 'email')}`;
}

export interface StoredBlockListEntry {
  id: string;
  value: string;
}

export interface BlockListChanges {
  /** Stored entries to remove: dropped from the list, or edited into another value. */
  remove: StoredBlockListEntry[];
  /** Values to add, each with the form row it came from. */
  add: { index: number; value: string }[];
}

/**
 * What a save of Edit Mailbox's Block list changes (contract part D: entries are added and removed one by one). A row
 * keeps its stored entry while its value is the same once normalized; an edited row is that entry removed and the new
 * value added.
 */
export function blockListChanges(
  stored: readonly StoredBlockListEntry[],
  rows: readonly BlockListRow[],
): BlockListChanges {
  const byId = new Map(stored.map(entry => [entry.id, entry]));
  const kept = new Set<string>();
  const add: BlockListChanges['add'] = [];
  rows.forEach((row, index) => {
    const value = normalizeBlockListValue(row.value);
    const entry = row.entryId ? byId.get(row.entryId) : undefined;
    if (entry && normalizeBlockListValue(entry.value) === value) {
      kept.add(entry.id);
      return;
    }
    if (value) add.push({ index, value });
  });
  return { remove: stored.filter(entry => !kept.has(entry.id)), add };
}
