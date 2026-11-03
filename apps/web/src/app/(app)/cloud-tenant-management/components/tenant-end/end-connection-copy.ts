import type { endConnectionViewQuery$data } from '@/__generated__/endConnectionViewQuery.graphql';
import { DirectoryProvider } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { pluralize } from '@/lib/pluralize';

// The copy of the Disconnect and Delete pages. Verbatim from Figma where a frame draws it: Disconnect for Microsoft 365
// (3287-23208) and Delete for Google Workspace (3287-22492). Each provider's steps in its own console are the same for
// both pages; where a sentence names a Microsoft credential, Google's says what Google holds.

export type EndConnectionMode = 'disconnect' | 'delete';

/** The connection the page is about, as its query reads it. */
export type EndConnectionRecord = NonNullable<endConnectionViewQuery$data['directoryConnection']>;

type EndConnectionImpact = EndConnectionRecord['impact'];

export interface EndConnectionRow {
  id: string;
  label: string;
  /** Empty while the counts are read: the row draws a bar. */
  value: string;
}

export interface EndConnectionSection {
  title: string;
  rows: EndConnectionRow[];
}

export interface CustomerTenantSteps {
  intro: string;
  items: readonly string[];
  /** One more thing, set apart from the choices above it. */
  note?: string;
}

interface ProviderEndCopy {
  disconnectIntro: string;
  credential: string;
  steps: CustomerTenantSteps;
}

const PROVIDER_END_COPY = {
  [DirectoryProvider.MICROSOFT_365]: {
    disconnectIntro:
      'OpenFrame deletes its credential and stops reading and writing. What was already read stays, read-only, and a reconnect with a new client secret picks up where it left off.',
    credential: 'the client secret',
    steps: {
      intro: 'Do one of these in Microsoft Entra (Entra ID › Enterprise applications › OpenFrame):',
      items: [
        'Delete it from Properties. Its consent and assignments go with it, and Entra keeps it restorable for 30 days.',
        'Or, to keep it for later, set "Enabled for users to sign-in?" to No under Properties, which stops all tokens, or revoke OpenFrame\'s grants under Permissions › Admin consent.',
      ],
    },
  },
  [DirectoryProvider.GOOGLE_WORKSPACE]: {
    disconnectIntro:
      'OpenFrame deletes its credential and stops reading and writing. What was already read stays, read-only, and a reconnect with a new consent picks up where it left off.',
    credential: 'the credential',
    steps: {
      intro: 'Do one of these in Google:',
      items: [
        'Admin console › Security › Access and data control › API controls › Manage Domain Wide Delegation: open the OpenFrame client and choose Delete. Access stops immediately.',
        'Or delete the service account in Google Cloud console (IAM & Admin › Service accounts). Google keeps it restorable for 30 days, but only through gcloud or the API, so to keep it for later choose Disable instead.',
      ],
      note: "If a Super Admin also approved OpenFrame's consent link: Security › Access and data control › API controls › Manage Third-Party App Access › OpenFrame › Blocked.",
    },
  },
} satisfies Record<DirectoryProvider, ProviderEndCopy>;

const UNKNOWN_PROVIDER: ProviderEndCopy = {
  disconnectIntro:
    'OpenFrame deletes its credential and stops reading and writing. What was already read stays, read-only, and a reconnect picks up where it left off.',
  credential: 'the credential',
  steps: { intro: "Remove OpenFrame's access in the provider's admin console.", items: [] },
};

const endCopy = (provider: string | null | undefined) =>
  presentationFor(PROVIDER_END_COPY, provider) ?? UNKNOWN_PROVIDER;

export const DELETE_INTRO =
  'Deletes the connection and everything it brought into OpenFrame, after an export if the customer wants one. This is a customer’s directory leaving the MSP — not offboarding, which is one user leaving a customer.';

export function endConnectionIntro(mode: EndConnectionMode, provider: string | null | undefined): string {
  return mode === 'delete' ? DELETE_INTRO : endCopy(provider).disconnectIntro;
}

export function customerTenantSteps(provider: string | null | undefined): CustomerTenantSteps {
  return endCopy(provider).steps;
}

/** The steps as the customer's admin receives them from Copy Instructions. */
export function customerTenantStepsText(provider: string | null | undefined): string {
  const { intro, items, note } = customerTenantSteps(provider);
  return [intro, ...items.map(item => `- ${item}`), ...(note ? [note] : [])].join('\n');
}

/** Licence assignments count every SKU; null until the numbers have been read. */
function assignmentsValue(impact: EndConnectionImpact | null): string {
  if (!impact) return '';
  return impact.licenseAssignments == null ? 'Not read yet' : pluralize(impact.licenseAssignments, 'assignment');
}

export function disconnectSections(impact: EndConnectionImpact | null): EndConnectionSection[] {
  return [
    { title: 'Stops', rows: [{ id: 'reading', label: 'Reading and writing', value: 'Sync, Suspend' }] },
    {
      title: 'Stays, read-only',
      rows: [
        {
          id: 'users',
          label: 'Users and groups',
          value: impact ? `${pluralize(impact.users, 'user')}, ${pluralize(impact.groups, 'group')}` : '',
        },
        { id: 'licences', label: 'Licences', value: assignmentsValue(impact) },
        { id: 'devices', label: 'Devices', value: 'Records and links, as of the last read' },
        { id: 'settings', label: 'Settings', value: 'Attribution rules and bindings' },
        { id: 'history', label: 'Run history', value: 'Write operations' },
      ],
    },
  ];
}

export function deleteSections(
  impact: EndConnectionImpact | null,
  provider: string | null | undefined,
): EndConnectionSection[] {
  return [
    {
      title: 'Deleted',
      rows: [
        {
          id: 'connection',
          label: 'Connection',
          value: `Its name, settings and ${endCopy(provider).credential} OpenFrame holds`,
        },
        {
          id: 'users',
          label: 'Users',
          value: impact ? `${pluralize(impact.users, 'record')}, with where each value came from` : '',
        },
        {
          id: 'groups',
          label: 'Groups',
          value: impact ? `${pluralize(impact.groups, 'group')} and their members` : '',
        },
        { id: 'licences', label: 'Licences', value: assignmentsValue(impact) },
        {
          id: 'devices',
          label: 'Devices',
          value: impact
            ? `${pluralize(impact.cloudOnlyDevices, 'cloud-only record')} and ${pluralize(impact.agentDeviceLinks, 'link')} to agent devices`
            : '',
        },
        { id: 'attribution', label: 'Attribution', value: 'The rules and the customer bindings' },
      ],
    },
    {
      title: 'Stays, read-only',
      rows: [{ id: 'audit', label: 'Audit trail', value: 'Every action taken on this tenant' }],
    },
  ];
}
