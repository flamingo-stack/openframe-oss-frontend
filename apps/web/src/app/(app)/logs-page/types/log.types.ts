import type { Instant } from '@/lib/graphql-scalars';
import type { PartialNamedDevice } from '../../devices/types/device.types';
import type { CopyableLogDetails } from '../utils/format-log-details';

/**
 * A log as the raw-POST paths still read it (`use-logs.ts`, `use-log-details.ts`).
 * The copy payload's fields come from the generated shape; the rest stays
 * restated by hand until those paths move to Relay.
 */
export interface LogEntry extends CopyableLogDetails {
  ingestDay: string;
  userId?: string;
  deviceId?: string;
  summary: string;
  metadata?: Record<string, unknown>;

  // Device-related fields from backend
  hostname?: string;
  /** User-defined device name, stamped on the event when it was ingested; null when it had none. */
  nickname?: string | null;
  organizationName?: string;
  organizationId?: string;

  // Transformed device object (follows Device type pattern)
  device?: PartialNamedDevice;
}

export interface LogEdge {
  node: LogEntry;
}

export interface LogFilters {
  toolTypes: string[];
  eventTypes: string[];
  severities: string[];
  organizations: { id: string; name: string }[];
}

export interface LogFilterInput {
  severities?: string[];
  toolTypes?: string[];
  organizationIds?: string[];
  deviceId?: string;
  userId?: string[];
  /** Inclusive bounds of the timestamp range filter */
  timestampFrom?: Instant;
  timestampTo?: Instant;
}
