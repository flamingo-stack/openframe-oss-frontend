// Seed data for the Tenant Management mock service (CU-86akj8ajt).
//
// The eight connections are the rows of the Figma list (node 1699-8249) in
// display order, with the details of the connected ones drawn from the phase-1
// prototype; the four extra organizations are what the "Select Customer" picker
// offers (customers already bound to a connection are excluded there). Relative
// instants are computed once at module load so "41m ago" is true on first paint.
// Pure data: nothing here may import React or the service.

import {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryProvider,
  DirectorySyncStatus,
} from '../types/directory-enums';
import type { TenantConnection, TenantOrganization } from '../types/tenant-connection';

const NOW = Date.now();
const minutesAgo = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString();

const READ_CAPABILITIES = [
  DirectoryCapability.USERS,
  DirectoryCapability.GROUPS,
  DirectoryCapability.ORG_UNITS,
  DirectoryCapability.LICENSES,
];

const ALL_CAPABILITIES = Object.values(DirectoryCapability);

const ORGANIZATIONS = {
  stonebridge: { id: 'org-stonebridge', name: 'Stonebridge Finance' },
  brightline: { id: 'org-brightline', name: 'Brightline Manufacture' },
  calderon: { id: 'org-calderon', name: 'Calderon Dental' },
  northwind: { id: 'org-northwind', name: 'Northwind Logistics' },
  harbourpoint: { id: 'org-harbourpoint', name: 'Harbourpoint Legal' },
  vellum: { id: 'org-vellum', name: 'Vellum Architecture' },
  ashgrove: { id: 'org-ashgrove', name: 'Ashgrove Care Homes' },
  quillfeather: { id: 'org-quillfeather', name: 'Quillfeather Media' },
  // Not bound to any connection — what a new connection can be bound to.
  meridian: { id: 'org-meridian', name: 'Meridian Trust' },
  ashgroveTrust: { id: 'org-ashgrove-trust', name: 'Ashgrove Community Trust' },
  vellumInteriors: { id: 'org-vellum-interiors', name: 'Vellum Interiors' },
  pinecrest: { id: 'org-pinecrest', name: 'Pinecrest Veterinary' },
} as const satisfies Record<string, TenantOrganization>;

export const TENANT_ORGANIZATION_FIXTURES: readonly TenantOrganization[] = Object.values(ORGANIZATIONS);

/**
 * What the mock's FIRST `check()` answers per seeded connection; the probe after
 * it recovers to READ_ONLY. Connections not listed here (and everything created
 * through the UI) answer READ_ONLY — the "CONNECTED AND READABLE" path — unless
 * their domain carries one of the QA suffixes in `tenant-connections-service.ts`.
 */
export const TENANT_CHECK_OUTCOME_FIXTURES: Readonly<Record<string, DirectoryAccessState>> = {
  'tc-01': DirectoryAccessState.DISCONNECTED,
  'tc-02': DirectoryAccessState.CONSENT_REVOKED,
};

export const TENANT_CONNECTION_FIXTURES: readonly TenantConnection[] = [
  {
    // Figma row 1 + the "not connected yet" details frame (2097-119207): a
    // record that exists but was never consented — no read, no users, "-".
    id: 'tc-01',
    provider: DirectoryProvider.MICROSOFT_365,
    name: 'Stonebridge Financial',
    domain: 'stonebridge.finance',
    enabled: true,
    directoryId: null,
    grantedBy: null,
    connectedAt: null,
    lastSyncStatus: DirectorySyncStatus.NEVER,
    lastSyncAt: null,
    lastSyncError: null,
    organizationId: ORGANIZATIONS.stonebridge.id,
    organization: ORGANIZATIONS.stonebridge,
    userCount: null,
    consentUrl:
      'https://login.microsoftonline.com/stonebridge.finance/adminconsent?client_id={client_id}&redirect_uri={redirect_uri}&state={state}',
    access: {
      state: DirectoryAccessState.DISCONNECTED,
      reason: 'Admin consent has not been granted yet.',
      checkedAt: minutesAgo(38),
      capabilities: [],
    },
    domains: [],
  },
  {
    // Figma row 2: consented once, revoked since — the directory is frozen at
    // its last read, which is why the row still carries users and an old date.
    id: 'tc-02',
    provider: DirectoryProvider.MICROSOFT_365,
    name: 'Brightline Manufacturing',
    domain: 'brightline-mfg.com',
    enabled: true,
    directoryId: '9d84e2f6-5c71-4a02-b6e8-31f9d40c7b25',
    grantedBy: 'infra@brightline-mfg.com',
    connectedAt: '2016-08-12T10:04:00.000Z',
    lastSyncStatus: DirectorySyncStatus.ERROR,
    lastSyncAt: '2016-10-10T08:12:00.000Z',
    lastSyncError: 'Consent was revoked in the customer admin console.',
    organizationId: ORGANIZATIONS.brightline.id,
    organization: ORGANIZATIONS.brightline,
    userCount: 227,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.CONSENT_REVOKED,
      reason: 'The customer removed OpenFrame’s access. Consent has to be granted again.',
      checkedAt: minutesAgo(31 * 60),
      capabilities: [],
    },
    domains: [
      { name: 'brightline-mfg.com', primary: true, verified: true },
      { name: 'brightline-group.com', primary: false, verified: true },
      { name: 'bl-industrial.com', primary: false, verified: true },
    ],
  },
  {
    id: 'tc-03',
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Calderon Dental Group',
    domain: 'calderondental.com',
    enabled: true,
    directoryId: 'C03k9xq7z',
    grantedBy: 'admin@calderondental.com',
    connectedAt: minutesAgo(96 * 24 * 60),
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: minutesAgo(41),
    lastSyncError: null,
    organizationId: ORGANIZATIONS.calderon.id,
    organization: ORGANIZATIONS.calderon,
    userCount: 96,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.WRITE_AVAILABLE,
      reason: null,
      checkedAt: minutesAgo(41),
      capabilities: READ_CAPABILITIES,
    },
    domains: [
      { name: 'calderondental.com', primary: true, verified: true },
      { name: 'calderon-ortho.com', primary: false, verified: true },
    ],
  },
  {
    // Every capability granted: the "Scopes held" row that has to wrap (Figma #109).
    id: 'tc-04',
    provider: DirectoryProvider.MICROSOFT_365,
    name: 'Northwind Logistics',
    domain: 'northwind.co',
    enabled: true,
    directoryId: 'e3f1c9a2-7b40-4d18-9c55-2a6f0b83d714',
    grantedBy: 'it@northwind.co',
    connectedAt: minutesAgo(214 * 24 * 60),
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: minutesAgo(14),
    lastSyncError: null,
    organizationId: ORGANIZATIONS.northwind.id,
    organization: ORGANIZATIONS.northwind,
    userCount: 184,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.WRITE_ENABLED,
      reason: null,
      checkedAt: minutesAgo(14),
      capabilities: ALL_CAPABILITIES,
    },
    domains: [
      { name: 'northwind.co', primary: true, verified: true },
      { name: 'northwind-freight.co', primary: false, verified: true },
    ],
  },
  {
    id: 'tc-05',
    provider: DirectoryProvider.MICROSOFT_365,
    name: 'Harbourpoint Legal',
    domain: 'harbourpoint.legal',
    enabled: true,
    directoryId: '7c2ab5d0-11e4-4f9a-8d33-6b02c7e15a88',
    grantedBy: 'ops@harbourpoint.legal',
    connectedAt: minutesAgo(61 * 24 * 60),
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: minutesAgo(7),
    lastSyncError: null,
    organizationId: ORGANIZATIONS.harbourpoint.id,
    organization: ORGANIZATIONS.harbourpoint,
    userCount: 61,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.READ_ONLY,
      reason: null,
      checkedAt: minutesAgo(7),
      capabilities: READ_CAPABILITIES,
    },
    domains: [{ name: 'harbourpoint.legal', primary: true, verified: true }],
  },
  {
    id: 'tc-06',
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Vellum Architecture',
    domain: 'vellum.studio',
    enabled: true,
    directoryId: 'C01vv84mt',
    grantedBy: 'studio@vellum.studio',
    connectedAt: minutesAgo(3 * 24 * 60),
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: minutesAgo(52),
    lastSyncError: null,
    organizationId: ORGANIZATIONS.vellum.id,
    organization: ORGANIZATIONS.vellum,
    userCount: 58,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.READ_ONLY,
      reason: null,
      checkedAt: minutesAgo(52),
      capabilities: READ_CAPABILITIES,
    },
    domains: [{ name: 'vellum.studio', primary: true, verified: true }],
  },
  {
    id: 'tc-07',
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Ashgrove Care Homes',
    domain: 'ashgrovecare.org',
    enabled: true,
    directoryId: 'C02ag6r1n',
    grantedBy: 'admin@ashgrovecare.org',
    connectedAt: minutesAgo(331 * 24 * 60),
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: minutesAgo(52),
    lastSyncError: null,
    organizationId: ORGANIZATIONS.ashgrove.id,
    organization: ORGANIZATIONS.ashgrove,
    userCount: 143,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.READ_ONLY,
      reason: null,
      checkedAt: minutesAgo(52),
      capabilities: READ_CAPABILITIES,
    },
    domains: [{ name: 'ashgrovecare.org', primary: true, verified: true }],
  },
  {
    id: 'tc-08',
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Quillfeather Media',
    domain: 'quillfeather.tv',
    enabled: true,
    directoryId: 'C05qf3d8w',
    grantedBy: 'ops@quillfeather.tv',
    connectedAt: minutesAgo(45 * 24 * 60),
    lastSyncStatus: DirectorySyncStatus.SUCCESS,
    lastSyncAt: minutesAgo(23),
    lastSyncError: null,
    organizationId: ORGANIZATIONS.quillfeather.id,
    organization: ORGANIZATIONS.quillfeather,
    userCount: 227,
    consentUrl: null,
    access: {
      state: DirectoryAccessState.WRITE_ENABLED,
      reason: null,
      checkedAt: minutesAgo(23),
      capabilities: ALL_CAPABILITIES,
    },
    domains: [{ name: 'quillfeather.tv', primary: true, verified: true }],
  },
];
