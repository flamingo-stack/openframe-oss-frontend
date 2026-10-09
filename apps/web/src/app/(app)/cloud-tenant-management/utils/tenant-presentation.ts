// Presentation tables for Cloud Tenant Management.
//
// Every enum → label/variant/copy decision lives here, declared with
// `satisfies Record<Enum, …>` so a widened enum (after `generate-enums`) stops
// type-checking until the new value is given an answer. Read with
// `presentationFor` because values reach the UI as plain strings and a backend
// ahead of the SDL is a runtime possibility, not a forgotten branch.

import {
  accessStateTag,
  type ProviderLogo,
  providerMark,
  type TenantAccessState,
  type TenantProvider,
  type TenantStatusTag,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryConsentIssueKind,
  DirectoryConsentOutcome,
  DirectoryProvider,
} from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { formatDate, formatTimeWithSeconds, toValidDate } from '@/lib/format-date';

// The list's own tables (access state tag, provider name and mark, "Last read", user count) live in
// the core library beside the list view, over unions that restate these schema enums. This is where
// the two are held together: a schema enum widened by `generate-enums` fails to type-check here
// until the library's table answers for the new value.
type CoveredBy<Schema extends Library, Library extends string> = Schema;
export type ListTablesCoverSchema = [
  CoveredBy<DirectoryAccessState, TenantAccessState>,
  CoveredBy<DirectoryProvider, TenantProvider>,
];

const READABLE_STATES = [
  DirectoryAccessState.READ_ONLY,
  DirectoryAccessState.WRITE_AVAILABLE,
  DirectoryAccessState.WRITE_ENABLED,
] as const;

type ReadableAccessState = (typeof READABLE_STATES)[number];

const READABLE_STATE_SET: ReadonlySet<string> = new Set(READABLE_STATES);

/** A connection whose last probe actually read the directory — what "connected" means on every screen. */
export function isReadable(state: string | null | undefined): boolean {
  return state != null && READABLE_STATE_SET.has(state);
}

// What to do about a probe that did not read the directory: the provider's raw code
// (`NO_CREDENTIAL`, …) means nothing to an MSP, so the UI says who has to act.
const ACCESS_STATE_HINT = {
  [DirectoryAccessState.DISCONNECTED]:
    "OpenFrame can't read this directory yet. Ask the customer's admin to open the consent link, then check again.",
  [DirectoryAccessState.NOT_AUTHORISED]:
    "The directory refused access. Ask the customer's admin to grant consent with the link, then check again.",
  [DirectoryAccessState.CONSENT_REVOKED]:
    "The customer's admin removed OpenFrame's access. Generate a new link and ask them to consent again.",
} satisfies Record<Exclude<DirectoryAccessState, ReadableAccessState>, string>;

/** The sentence under a failed "Check Connection"; an unknown state falls back to its tag label. */
export function accessStateHint(state: string | null | undefined): string {
  return presentationFor(ACCESS_STATE_HINT, state) ?? accessStateTag(state).label;
}

/** The tag beside "Check Connection" once a probe has answered (Figma 2097-122274). */
export function checkResultTag(access: { readonly state: string }): TenantStatusTag {
  return isReadable(access.state)
    ? { label: 'Connected and readable', variant: 'success' }
    : accessStateTag(access.state);
}

export interface ConsentAlert {
  variant: 'warning' | 'error';
  message: string;
}

/** `lastConsentInfo` as the alert reads it; the component unpacks it, so the fragment's fields stay its own. */
export interface ConsentAttempt {
  readonly outcome: string;
  readonly deniedTiers: readonly string[];
  /** The issues themselves render in their own card below the alert. */
  readonly hasIssues: boolean;
}

const NOT_CONNECTED_YET = "Tenant is still not connected. Data aren't available yet.";

type FailedConsentOutcome = Exclude<
  DirectoryConsentOutcome,
  typeof DirectoryConsentOutcome.CONNECTED | typeof DirectoryConsentOutcome.PARTIAL
>;

// The Microsoft outcomes and ERROR are the product copy verbatim. Google's two and EXPIRED have no
// copy yet and follow its pattern: what happened, then Reconnect.
const FAILED_CONSENT_MESSAGE = {
  [DirectoryConsentOutcome.DENIED]: () =>
    "The admin cancelled Google's consent screen. Use Reconnect and approve the requested permissions.",
  [DirectoryConsentOutcome.WRONG_DOMAIN]: domain =>
    `The Google account that signed in isn't a verified admin of ${domain}. Use Reconnect and sign in as a Super Admin of ${domain}.`,
  [DirectoryConsentOutcome.SIGN_IN_FAILED]: () =>
    "Microsoft sign-in didn't complete. It was cancelled or couldn't be verified. Use Reconnect and sign in again.",
  [DirectoryConsentOutcome.NOT_ADMIN]: () =>
    "The account that signed in isn't a Global Administrator or Privileged Role Administrator. Use Reconnect and sign in with one of these roles.",
  [DirectoryConsentOutcome.WRONG_TENANT]: domain =>
    `The admin signed in to a different Microsoft 365 organization. Use Reconnect and sign in with an admin account from ${domain}.`,
  [DirectoryConsentOutcome.NOT_CONSENTED]: () =>
    "Microsoft couldn't find approval for the OpenFrame app in this organization. Use Reconnect to approve it again. If this keeps happening, contact support.",
  [DirectoryConsentOutcome.ERROR]: () =>
    'Something went wrong while connecting this tenant. Try Reconnect in a few minutes. If it keeps failing, contact support.',
  [DirectoryConsentOutcome.EXPIRED]: () =>
    "The consent link expired before it was used. Use Reconnect to generate a new link and send it to the customer's admin.",
} satisfies Record<FailedConsentOutcome, (domain: string) => string>;

// PARTIAL with declined tiers is verbatim from Figma (settings 2885-2333). A PARTIAL without any is a
// tier Microsoft itself failed, which the issues card below names.
function partialMessage(deniedTiers: readonly string[]): string {
  return deniedTiers.length > 0
    ? `Connected with limited access. The admin declined some permissions: ${deniedTiers.join(', ')}. Use Reconnect to approve them if you need that data.`
    : 'Connected with limited access. Some permissions were not granted.';
}

/**
 * The alert under the details card: how the last consent attempt ended, from `lastConsentInfo`.
 * A clean CONNECTED says nothing, and neither does a readable tenant with no attempt on record; an
 * unreadable one keeps the generic sentence (no attempt recorded, or a grant revoked since).
 */
export function consentAlert(
  attempt: ConsentAttempt | null | undefined,
  { readable, domain }: { readable: boolean; domain: string | null | undefined },
): ConsentAlert | null {
  const notConnectedYet: ConsentAlert | null = readable ? null : { variant: 'warning', message: NOT_CONNECTED_YET };
  if (!attempt) return notConnectedYet;

  if (attempt.outcome === DirectoryConsentOutcome.PARTIAL) {
    return { variant: 'warning', message: partialMessage(attempt.deniedTiers) };
  }
  if (attempt.outcome === DirectoryConsentOutcome.CONNECTED) {
    return attempt.hasIssues
      ? { variant: 'warning', message: 'Connected. Some permissions are not active yet.' }
      : notConnectedYet;
  }
  const failed = presentationFor(FAILED_CONSENT_MESSAGE, attempt.outcome);
  // An outcome newer than this build reads as no outcome at all.
  return failed ? { variant: 'error', message: failed(domain || "the customer's domain") } : notConnectedYet;
}

// The issue's own tag beside its tier. A provider error names who failed (the way Entra and Google
// put their brand on their own error pages); a pending grant is grey because it settles by itself.
const CONSENT_ISSUE_TAG = {
  [DirectoryConsentIssueKind.PROVIDER_ERROR]: (providerLabel: string) => ({
    label: `${providerLabel} error`,
    variant: 'error',
  }),
  [DirectoryConsentIssueKind.PERMISSIONS_PENDING]: () => ({ label: 'Pending', variant: 'grey' }),
} satisfies Record<DirectoryConsentIssueKind, (providerLabel: string) => TenantStatusTag>;

/** Tag for a consent issue's kind; an unknown kind renders as itself in grey. */
export function consentIssueTag(kind: string, provider: string): TenantStatusTag {
  const tag = presentationFor(CONSENT_ISSUE_TAG, kind);
  return tag ? tag(providerPresentation(provider).label) : { label: kind, variant: 'grey' };
}

/** The provider's error code, or null for none: the backend writes `unknown` when the provider gave none. */
export function consentIssueCode(providerCode: string | null | undefined): string | null {
  return providerCode && providerCode !== 'unknown' ? providerCode : null;
}

const AADSTS_CODE = /^AADSTS(\d+)$/;

/**
 * Microsoft's own error lookup for an AADSTS code (the "Error code lookup tool" its sign-in docs
 * point to). Google publishes no such page for its OAuth error tokens, so they get none.
 */
export function providerErrorLookupUrl(code: string | null): string | null {
  const digits = code ? AADSTS_CODE.exec(code)?.[1] : undefined;
  return digits ? `https://login.microsoftonline.com/error?code=${digits}` : null;
}

export interface ConsentIssueReport {
  readonly provider: string;
  readonly domain: string | null;
  readonly occurredAt: string | null;
  readonly tier: string | null;
  readonly code: string | null;
  readonly correlationId: string | null;
  readonly message: string;
}

/**
 * "Copy details": one issue as plain text for a support ticket, the block Entra's "Copy info to
 * clipboard" hands out. The instant stays the wire's UTC — support correlates on it, not on local time.
 */
export function consentIssueReport(report: ConsentIssueReport): string {
  const lines: [string, string | null][] = [
    ['Provider', providerPresentation(report.provider).label],
    ['Domain', report.domain],
    ['Tier', report.tier],
    ['Error code', report.code],
    ['Correlation ID', report.correlationId],
    ['Time (UTC)', report.occurredAt],
    ['Message', report.message],
  ];
  return lines
    .filter((line): line is [string, string] => Boolean(line[1]))
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

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
const PROVIDER_COPY = {
  [DirectoryProvider.MICROSOFT_365]: {
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
    radioDescription: 'Two actions from a Super Admin, then a verification read. No reseller agreement.',
    consentInstruction:
      "Open the link below and sign in as a Super Admin of the customer's Google Workspace, then approve the requested permissions.",
    reapproveInstruction:
      "To update or re-approve OpenFrame's access, open the link below and sign in as a Super Admin of the customer's Google Workspace. Existing settings stay unchanged until consent is granted again.",
    openLabel: 'Open in Google Admin',
    directoryIdLabel: 'Google customer ID',
    authorisedBy: "Google OAuth admin consent · one link, trusted from the customer's service account",
  },
} satisfies Record<DirectoryProvider, ProviderCopy>;

type ProviderCopy = Omit<ProviderPresentation, 'label' | 'Logo'>;

const UNKNOWN_PROVIDER: ProviderCopy = {
  radioDescription: '',
  consentInstruction: 'Open the link below and approve the requested permissions in the provider admin console.',
  reapproveInstruction: 'Open the link below and re-approve the requested permissions in the provider admin console.',
  openLabel: 'Open consent link',
  directoryIdLabel: 'Directory ID',
  authorisedBy: 'Admin consent',
};

/** Presentation for a provider; an unknown value keeps its raw name and a neutral mark. */
export function providerPresentation(provider: string | null | undefined): ProviderPresentation {
  // Name and mark are the library's (the list draws them too); the copy is this module's.
  return { ...providerMark(provider), ...(presentationFor(PROVIDER_COPY, provider) ?? UNKNOWN_PROVIDER) };
}

/** The providers the picker offers, in Figma order (Microsoft first). */
export const PROVIDER_ORDER: readonly DirectoryProvider[] = [
  DirectoryProvider.MICROSOFT_365,
  DirectoryProvider.GOOGLE_WORKSPACE,
];

const CAPABILITY_LABELS = {
  [DirectoryCapability.USERS]: 'Users',
  [DirectoryCapability.GROUPS]: 'Groups',
  [DirectoryCapability.ORG_UNITS]: 'Org units',
  [DirectoryCapability.LICENSES]: 'Licences',
  [DirectoryCapability.DEVICES]: 'Devices',
  [DirectoryCapability.AUDIT_LOGS]: 'Audit logs',
  [DirectoryCapability.OAUTH_APPS]: 'OAuth apps',
  [DirectoryCapability.ADMIN_ROLES]: 'Admin roles',
} satisfies Record<DirectoryCapability, string>;

/** "Scopes held" — labels in declaration order; an unknown capability keeps its raw name. */
export function capabilityLabels(capabilities: readonly string[]): string[] {
  return capabilities.map(capability => presentationFor(CAPABILITY_LABELS, capability) ?? capability);
}

/** The two-tone "11/12/24 09:43:00" of the details card; `null` = never connected. */
export function formatConnectedAt(iso: string | null | undefined): { date: string; time: string } | null {
  const date = toValidDate(iso);
  return date ? { date: formatDate(date), time: formatTimeWithSeconds(date) } : null;
}
