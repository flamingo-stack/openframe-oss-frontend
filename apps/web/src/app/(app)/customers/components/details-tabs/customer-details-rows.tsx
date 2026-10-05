import type { PanelRow } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { CONTACT_FIELD_LABELS } from '../../types/customer-form.types';

/**
 * The row shapes of the customer Details tab, shared by the tab and its
 * skeleton so the two cannot drift: the tab hands in the values, the skeleton
 * hands in placeholders, and the ids, labels and breakpoint classes come from
 * here.
 *
 * `StackedRowsPanel` keeps a multi-column row horizontal at every width, so a
 * row that must stack on a phone is written twice — once for md+ and once
 * below — the way the policy details page does it. The panel drops the bottom
 * border of its LAST DOM child only; with the mobile rows coming last, every
 * md+ row that ends its card drops the border itself.
 */
const SINGLE_COLUMN_ROW = 'md:min-h-20 md:py-0';
const DESKTOP_ROW = 'hidden md:flex';
const DESKTOP_LAST_ROW = 'hidden md:flex md:border-b-0';
const MOBILE_ROW = 'md:hidden';

export interface CustomerInfoCells {
  website: ReactNode;
  websiteHref?: string;
  websiteIcon?: ReactNode;
  physicalAddress: ReactNode;
  mailingAddress: ReactNode;
}

/** Website on its own row; the two addresses side by side from md, one per row below. */
export function buildCustomerInfoRows(cells: CustomerInfoCells): PanelRow[] {
  const physical = { key: 'physical', value: cells.physicalAddress, label: 'Physical Address' };
  const mailing = { key: 'mailing', value: cells.mailingAddress, label: 'Mailing Address' };

  return [
    {
      id: 'website',
      className: SINGLE_COLUMN_ROW,
      columns: [
        { key: 'website', icon: cells.websiteIcon, value: cells.website, label: 'Website', href: cells.websiteHref },
      ],
    },
    { id: 'addresses', className: DESKTOP_LAST_ROW, columns: [physical, mailing] },
    { id: 'physical-mobile', className: cn(MOBILE_ROW, SINGLE_COLUMN_ROW), columns: [physical] },
    { id: 'mailing-mobile', className: cn(MOBILE_ROW, SINGLE_COLUMN_ROW), columns: [mailing] },
  ];
}

export type CustomerContactField = keyof typeof CONTACT_FIELD_LABELS;
export type CustomerContactCells = Record<CustomerContactField, ReactNode>;

/** Per contact: the four cells in one row from md; name + title, then email + phone below. */
export function buildCustomerContactRows(contacts: CustomerContactCells[]): PanelRow[] {
  return contacts.flatMap((contact, index) => {
    const column = (field: CustomerContactField) => ({
      key: field,
      value: contact[field],
      label: CONTACT_FIELD_LABELS[field],
    });
    const isLast = index === contacts.length - 1;

    return [
      {
        id: `contact-${index}`,
        className: isLast ? DESKTOP_LAST_ROW : DESKTOP_ROW,
        columns: [column('contactName'), column('title'), column('email'), column('phone')],
      },
      { id: `contact-${index}-mobile-1`, className: MOBILE_ROW, columns: [column('contactName'), column('title')] },
      { id: `contact-${index}-mobile-2`, className: MOBILE_ROW, columns: [column('email'), column('phone')] },
    ];
  });
}

export const NO_CONTACTS_COPY = 'No contacts yet — add them from Edit Customer.';

/** The contacts card with nothing to show — the same shape as one row, the same copy style as the Notes card. */
export function buildNoContactsRow(): PanelRow {
  return {
    id: 'contacts-empty',
    className: 'flex items-center p-[var(--spacing-system-m)] md:min-h-20',
    content: <p className="text-ods-text-secondary text-h4">{NO_CONTACTS_COPY}</p>,
  };
}
