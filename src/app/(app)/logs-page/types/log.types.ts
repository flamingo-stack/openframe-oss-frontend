import type { PartialNamedDevice } from '../../devices/types/device.types';

export interface LogEntry {
  toolEventId: string;
  eventType: string;
  ingestDay: string;
  toolType: string;
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  userId?: string;
  deviceId?: string;
  summary: string;
  message?: string;
  timestamp: string;
  details?: string;
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
  /** Inclusive UTC ISO-8601 bounds of the timestamp range filter */
  timestampFrom?: string;
  timestampTo?: string;
}
