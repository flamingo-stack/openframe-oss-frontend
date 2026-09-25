// Presentation tables for Tenant Management.
//
// Every enum → label/variant/copy decision lives here, declared with
// `satisfies Record<Enum, …>` so a widened enum (after `generate-enums`) stops
// type-checking until the new value is given an answer. Read with
// `presentationFor` because values reach the UI as plain strings and a backend
// ahead of the SDL is a runtime possibility, not a forgotten branch.

import {
  CodingForkIcon,
  GoogleLogoIcon,
  Office365LogoIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ComponentType, SVGProps } from 'react';
import { presentationFor } from '@/lib/exhaustive-map';
import { formatDate, formatTimeWithSeconds } from '@/lib/format-date';
import { DirectoryAccessState, type DirectoryCapability, DirectoryProvider } from '../types/directory-enums';
import type { TenantAccess, TenantConnection } from '../types/tenant-connection';

/** The grey "-" the design checks require wherever data is missing. */
export const EMPTY_VALUE = '-';

type TagVariant = NonNullable<TagProps['variant']>;

export interface StatusTag {
  label: string;
  variant: TagVariant;
}

// Colours read off the Figma list (node 1699-8249): red for the two states that
// need the customer's admin, grey for read-only, outline for write-available,
// green for write-enabled. NOT_AUTHORISED has no frame of its own
// and follows CONSENT_REVOKED — it is the other "the directory refused us" state.
const ACCESS_STATE_PRESENTATION = {
  [DirectoryAccessState.DISCONNECTED]: { label: 'Disconnected', variant: 'error' },
  [DirectoryAccessState.NOT_AUTHORISED]: { label: 'Not authorised', variant: 'error' },
  [DirectoryAccessState.CONSENT_REVOKED]: { label: 'Consent revoked', variant: 'error' },
  [DirectoryAccessState.READ_ONLY]: { label: 'Read only', variant: 'grey' },
  [DirectoryAccessState.WRITE_AVAILABLE]: { label: 'Write available', variant: 'outline' },
  [DirectoryAccessState.WRITE_ENABLED]: { label: 'Write enabled', variant: 'success' },
} satisfies Record<DirectoryAccessState, StatusTag>;

/** Tag props for an access state; an unknown value renders as itself in grey. */
export function accessStateTag(state: string | null | undefined): StatusTag {
  return presentationFor(ACCESS_STATE_PRESENTATION, state) ?? { label: state || EMPTY_VALUE, variant: 'grey' };
}

const READABLE_STATES: ReadonlySet<string> = new Set([
  DirectoryAccessState.READ_ONLY,
  DirectoryAccessState.WRITE_AVAILABLE,
  DirectoryAccessState.WRITE_ENABLED,
]);

/** A connection whose last probe actually read the directory — what "connected" means on every screen. */
export function isReadable(state: string | null | undefined): boolean {
  return state != null && READABLE_STATES.has(state);
}

/** The tag beside "Check Connection" once a probe has answered (Figma 2097-122274). */
export function checkResultTag(access: TenantAccess): StatusTag {
  return isReadable(access.state)
    ? { label: 'Connected and readable', variant: 'success' }
    : accessStateTag(access.state);
}

/** An icons-v2 brand mark: sized by `size`, labelled for assistive tech where it stands alone. */
export type ProviderLogo = ComponentType<
  { className?: string; size?: number } & Pick<SVGProps<SVGSVGElement>, 'role' | 'aria-label'>
>;

export interface ProviderPresentation {
  label: string;
  Logo: ProviderLogo;
  /** Second line of the provider radio (Figma 2097-122192). */
  radioDescription: string;
  /** Consent card copy on New / details-not-connected (Figma 2097-122222). */
  consentInstruction: string;
  /** Consent card copy on Reconnect (Figma 2108-81037). */
  reapproveInstruction: string;
  /** Label of the "open the consent link" action. */
  openLabel: string;
  /** Row label for the provider's own directory id on the details page. */
  directoryIdLabel: string;
  /** "Authorised by" row on the details page. */
  authorisedBy: string;
}

// Copy is verbatim from the Figma frames for Microsoft. Google has no frame of
// its own (the Phase 1 doc calls it "the only screen that cannot be drawn"), so
// its consent copy mirrors Microsoft's with the Super Admin wording — a data gap
// one string each to replace when the copy is written.
const PROVIDER_PRESENTATION = {
  [DirectoryProvider.MICROSOFT_365]: {
    label: 'Microsoft 365',
    Logo: Office365LogoIcon,
    radioDescription: 'One approval from a Global Administrator. No CSP relationship, no GDAP.',
    consentInstruction:
      "Open the link below and sign in as a Global Administrator of the customer's tenant, then approve the requested permissions. No CSP or GDAP relationship is required.",
    reapproveInstruction:
      "To update or re-approve OpenFrame's access, open the link below and sign in as a Global Administrator of the customer's tenant. Existing settings stay unchanged until consent is granted again.",
    openLabel: 'Open in Microsoft Entra',
    directoryIdLabel: 'Directory (tenant) ID',
    authorisedBy: 'Entra admin consent · one action, no CSP or GDAP relationship',
  },
  [DirectoryProvider.GOOGLE_WORKSPACE]: {
    label: 'Google Workspace',
    Logo: GoogleLogoIcon,
    radioDescription: 'Two actions from a Super Admin, then a verification read. No reseller agreement.',
    consentInstruction:
      "Open the link below and sign in as a Super Admin of the customer's Google Workspace, then approve the requested permissions.",
    reapproveInstruction:
      "To update or re-approve OpenFrame's access, open the link below and sign in as a Super Admin of the customer's Google Workspace. Existing settings stay unchanged until consent is granted again.",
    openLabel: 'Open in Google Admin',
    directoryIdLabel: 'Google customer ID',
    authorisedBy: "Google OAuth admin consent · one link, trusted from the customer's service account",
  },
} satisfies Record<DirectoryProvider, ProviderPresentation>;

const UNKNOWN_PROVIDER: Omit<ProviderPresentation, 'label'> = {
  Logo: CodingForkIcon,
  radioDescription: '',
  consentInstruction: 'Open the link below and approve the requested permissions in the provider admin console.',
  reapproveInstruction: 'Open the link below and re-approve the requested permissions in the provider admin console.',
  openLabel: 'Open consent link',
  directoryIdLabel: 'Directory ID',
  authorisedBy: 'Admin consent',
};

/** Presentation for a provider; an unknown value keeps its raw name and a neutral mark. */
export function providerPresentation(provider: string | null | undefined): ProviderPresentation {
  return (
    presentationFor(PROVIDER_PRESENTATION, provider) ?? { ...UNKNOWN_PROVIDER, label: provider || 'Unknown provider' }
  );
}

/** The providers the picker offers, in Figma order (Microsoft first). */
export const PROVIDER_ORDER: readonly DirectoryProvider[] = [
  DirectoryProvider.MICROSOFT_365,
  DirectoryProvider.GOOGLE_WORKSPACE,
];

const CAPABILITY_LABELS = {
  USERS: 'Users',
  GROUPS: 'Groups',
  ORG_UNITS: 'Org units',
  LICENSES: 'Licences',
  DEVICES: 'Devices',
  AUDIT_LOGS: 'Audit logs',
  OAUTH_APPS: 'OAuth apps',
  ADMIN_ROLES: 'Admin roles',
} satisfies Record<DirectoryCapability, string>;

/** "Scopes held" — labels in declaration order; an unknown capability keeps its raw name. */
export function capabilityLabels(capabilities: readonly string[]): string[] {
  return capabilities.map(capability => presentationFor(CAPABILITY_LABELS, capability) ?? capability);
}

/**
 * The instant "Last read" reports: the directory sync, not the
 * access probe — a probe proves the link, a sync is when the data was read.
 */
export function lastReadAt(connection: Pick<TenantConnection, 'lastSyncAt'>): string | null {
  return connection.lastSyncAt ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "41m ago" while fresh, the calendar date once a day old (the design shows
 * "Last read: 10/10/2016" on a stale row), "-" when there was never a read.
 * `formatRelativeTime` is guarded because it answers "Unknown time" for an
 * invalid instant and warns on the console.
 */
export function formatLastRead(iso: string | null | undefined, now: Date = new Date()): string {
  const date = parseInstant(iso);
  if (!date) return EMPTY_VALUE;
  return now.getTime() - date.getTime() < DAY_MS ? formatRelativeTime(date) : formatDate(date);
}

/** The two-tone "11/12/24 09:43:00" of the details card; `null` = never connected. */
export function formatConnectedAt(iso: string | null | undefined): { date: string; time: string } | null {
  const date = parseInstant(iso);
  return date ? { date: formatDate(date), time: formatTimeWithSeconds(date) } : null;
}

/** "227 Users" under the customer, "-" before the first read. */
export function usersCountLabel(count: number | null | undefined): string {
  if (count == null) return EMPTY_VALUE;
  return `${count} ${count === 1 ? 'User' : 'Users'}`;
}
