'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ShieldIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { formatDateTime } from '@/lib/format-date';
import type { Device } from '../../types/device.types';
import { TabDeployingEmptyState, TabEmptyState } from './tab-empty-state';

interface SecurityTabProps {
  device: Device | null;
}

/**
 * Status of a single posture row. Drives the value color and the trailing icon,
 * matching the Security design (green check = good, red/amber alert = attention).
 */
type SecurityStatus = 'success' | 'error' | 'warning' | 'neutral';

interface SecurityRow {
  label: string;
  value: string;
  /** Defaults to `neutral` (white value, no trailing icon). */
  status?: SecurityStatus;
}

interface SecurityCard {
  title?: string;
  rows: SecurityRow[];
}

interface SecuritySection {
  id: string;
  title: string;
  cards: SecurityCard[];
}

/**
 * The tab's static copy: section headings, card titles and row labels. ONE table, read by `buildSections` (the loaded
 * tab) and by `LOADING_SECTIONS` (its loading form), so the two cannot disagree.
 */
const SECTION = {
  encryption: { id: 'encryption', title: 'Encryption' },
  agents: { id: 'agents', title: 'Security Agents' },
  posture: { id: 'posture', title: 'Posture' },
} as const;

const ROW = {
  diskEncryption: 'Disk Encryption',
  version: 'Version',
  lastSeen: 'Last Seen',
  status: 'Status',
  failingPolicies: 'Failing Policies',
  totalIssues: 'Total Issues',
} as const;

const CARD_TITLE = { diskEncryption: 'Disk Encryption', policyCompliance: 'Policy Compliance' } as const;

/** Each security agent's card: its title (the agent's name) and its rows, in the order the section shows them. */
const AGENT_CARD = {
  openframe: { title: 'OpenFrame Agent', rows: [ROW.version, ROW.lastSeen] },
  osquery: { title: 'osquery', rows: [ROW.version, ROW.status] },
  orbit: { title: 'Orbit', rows: [ROW.version, ROW.status] },
  fleetDesktop: { title: 'Fleet Desktop', rows: [ROW.version] },
} as const;

const VALUE_COLOR: Record<SecurityStatus, string> = {
  success: 'text-ods-success',
  error: 'text-ods-error',
  warning: 'text-ods-warning',
  neutral: 'text-ods-text-primary',
};

const STATUS_ROW_CLASS = 'flex h-6 w-full items-center gap-[var(--spacing-system-xs)]';
const STATUS_ROW_LABEL_CLASS = 'whitespace-nowrap text-ods-text-secondary text-h4';
const STATUS_CARD_CLASS =
  'flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]';
const STATUS_CARD_ROWS_CLASS = 'flex w-full flex-col gap-[var(--spacing-system-xs)]';
const SECTION_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)]';
const SECTION_HEADING_CLASS = 'uppercase text-ods-text-secondary text-h5';

function StatusRow({ label, value, status = 'neutral' }: SecurityRow) {
  // While the device is read the label is real and the value a bar (no status icon yet).
  const loading = useLoadingScope();
  const icon = loading ? null : status === 'success' ? (
    <CheckCircleIcon size={16} className="shrink-0 text-ods-success" />
  ) : status === 'error' ? (
    <AlertTriangleIcon size={16} className="shrink-0 text-ods-error" />
  ) : status === 'warning' ? (
    <AlertTriangleIcon size={16} className="shrink-0 text-ods-warning" />
  ) : null;

  return (
    <div data-loading-item className={STATUS_ROW_CLASS}>
      <span className={STATUS_ROW_LABEL_CLASS}>{label}</span>
      <div className="h-px flex-1 bg-ods-divider" />
      <div className="min-w-0">
        {loading ? (
          <TextLineSkeleton type="h4" className="w-20" />
        ) : (
          <TruncateText className={VALUE_COLOR[status]}>{value}</TruncateText>
        )}
      </div>
      {icon}
    </div>
  );
}

/** Host-local replica of the design's posture card (core `InfoCard` can't color values or add status icons). */
function SecurityStatusCard({ title, rows }: SecurityCard) {
  // While the device is read a card whose title is the agent's name draws it as a bar.
  const loading = useLoadingScope();
  return (
    <div data-loading-item className={STATUS_CARD_CLASS}>
      {title ? <TruncateText>{title}</TruncateText> : loading && <TextLineSkeleton type="h4" className="w-32" />}
      <div className={STATUS_CARD_ROWS_CLASS}>
        {rows.map(row => (
          <StatusRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

function SecuritySectionBlock({ title, cards }: Omit<SecuritySection, 'id'>) {
  return (
    <section className={SECTION_CLASS}>
      <h3 className={SECTION_HEADING_CLASS}>{title}</h3>
      <div
        className={cn('grid grid-cols-1 gap-[var(--spacing-system-l)]', cards.length > 1 && 'content-lg:grid-cols-3')}
      >
        {cards.map((card, index) => (
          <SecurityStatusCard key={card.title ?? index} {...card} />
        ))}
      </div>
    </section>
  );
}

/** Agent version usable for display — sources report "unknown" (Fleet) or empty strings for missing data. */
function normalizeVersion(version: string | undefined): string | undefined {
  const trimmed = version?.trim();
  return trimmed && trimmed.toLowerCase() !== 'unknown' ? trimmed : undefined;
}

/**
 * Build the posture sections from the data we actually have on the normalized device.
 * Sections with no real data are omitted entirely (no "Unknown/N/A" filler), so the
 * design's Firewall / Defender / per-drive BitLocker / SIP blocks simply don't render
 * until the backend surfaces those osquery tables.
 */
function buildSections(device: Device): SecuritySection[] {
  const sections: SecuritySection[] = [];

  // Encryption — the BitLocker/FileVault analog we can populate (single boolean).
  if (device.disk_encryption_enabled !== undefined) {
    sections.push({
      ...SECTION.encryption,
      cards: [
        {
          title: CARD_TITLE.diskEncryption,
          rows: [
            {
              label: ROW.diskEncryption,
              value: device.disk_encryption_enabled ? 'Encrypted' : 'Not Encrypted',
              status: device.disk_encryption_enabled ? 'success' : 'error',
            },
          ],
        },
      ],
    });
  }

  // Security agents — one card per agent that reports a version.
  // Versions come from the OpenFrame agent registry (installedAgents) first — Fleet's own
  // host fields (orbit_version) report "unknown" for the Flamingo fleetmdm fork agent.
  const agentCards: SecurityCard[] = [];
  const installedVersion = (agentType: string): string | undefined =>
    normalizeVersion(device.installedAgents?.find(agent => agent.agentType === agentType)?.version);
  const openframeVersion = installedVersion('openframe-client') || normalizeVersion(device.agentVersion);
  if (openframeVersion) {
    agentCards.push({
      title: AGENT_CARD.openframe.title,
      rows: [
        { label: ROW.version, value: openframeVersion },
        { label: ROW.lastSeen, value: formatDateTime(device.last_seen) },
      ],
    });
  }
  if (device.osquery_version) {
    agentCards.push({
      title: AGENT_CARD.osquery.title,
      rows: [
        { label: ROW.version, value: device.osquery_version },
        { label: ROW.status, value: 'Active', status: 'success' },
      ],
    });
  }
  const orbitVersion = installedVersion('fleetmdm-agent') || normalizeVersion(device.orbit_version);
  if (orbitVersion) {
    agentCards.push({
      title: AGENT_CARD.orbit.title,
      rows: [
        { label: ROW.version, value: orbitVersion },
        { label: ROW.status, value: 'Active', status: 'success' },
      ],
    });
  }
  if (device.fleet_desktop_version) {
    agentCards.push({
      title: AGENT_CARD.fleetDesktop.title,
      rows: [{ label: ROW.version, value: device.fleet_desktop_version }],
    });
  }
  if (agentCards.length > 0) {
    sections.push({ ...SECTION.agents, cards: agentCards });
  }

  // Posture — Fleet policy/issue summary (from the host payload `issues`).
  const postureRows: SecurityRow[] = [];
  if (device.failingPoliciesCount !== undefined) {
    postureRows.push({
      label: ROW.failingPolicies,
      value: String(device.failingPoliciesCount),
      status: device.failingPoliciesCount > 0 ? 'error' : 'success',
    });
  }
  if (device.totalIssuesCount !== undefined) {
    postureRows.push({
      label: ROW.totalIssues,
      value: String(device.totalIssuesCount),
      status: device.totalIssuesCount > 0 ? 'warning' : 'success',
    });
  }
  if (postureRows.length > 0) {
    sections.push({
      ...SECTION.posture,
      cards: [{ title: CARD_TITLE.policyCompliance, rows: postureRows }],
    });
  }

  return sections;
}

/** A loading card's rows: the labels real, every value a bar. */
function loadingRows(labels: readonly string[]): SecurityRow[] {
  return labels.map(label => ({ label, value: '' }));
}

/**
 * The sections `buildSections` draws for a typical device, drawn while the device is read, from the same copy table:
 * the static headings, card titles and row labels real; an agent card's title (the agent's name, which agents a
 * device reports is read) and every value a bar. A typical Fleet host reports every agent (Fleet Desktop ships with
 * Orbit).
 */
const LOADING_SECTIONS: SecuritySection[] = [
  { ...SECTION.encryption, cards: [{ title: CARD_TITLE.diskEncryption, rows: loadingRows([ROW.diskEncryption]) }] },
  { ...SECTION.agents, cards: Object.values(AGENT_CARD).map(card => ({ rows: loadingRows(card.rows) })) },
  {
    ...SECTION.posture,
    cards: [{ title: CARD_TITLE.policyCompliance, rows: loadingRows([ROW.failingPolicies, ROW.totalIssues]) }],
  },
];

export function SecurityTab({ device }: SecurityTabProps) {
  const loading = useLoadingScope();

  if (!loading && !device) {
    return (
      <TabEmptyState
        icon={<ShieldIcon />}
        title="No security data found"
        description="Security details for this device will appear here."
      />
    );
  }

  const sections = device ? buildSections(device) : LOADING_SECTIONS;

  if (!loading && sections.length === 0) {
    if (device?.sources?.fleet === 'skipped-pending') {
      return <TabDeployingEmptyState icon={<ShieldIcon />} section="Security" />;
    }
    return (
      <TabEmptyState
        icon={<ShieldIcon />}
        title="No security data found"
        description="Security details for this device will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {sections.map(section => (
        <SecuritySectionBlock key={section.id} title={section.title} cards={section.cards} />
      ))}
    </div>
  );
}
