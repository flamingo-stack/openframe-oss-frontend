import { getRelayErrorCode } from '@/lib/handle-api-error';
import { isOfflineError, loadErrorProps } from '@/lib/query-state';
import { DEVICE_LOG_SEARCH_REJECTED_MESSAGE } from './device-log-search';

export type DeviceLogErrorKind = 'offline' | 'not-found' | 'validation' | 'unavailable' | 'search-rejected' | 'generic';

export interface DeviceLogErrorInfo {
  kind: DeviceLogErrorKind;
  /** User-facing copy — never the raw message except for VALIDATION_ERROR, whose text names the offending rule. */
  message: string;
  /** `errors[0].extensions.code` when the API answered; null for transport/offline failures. */
  code: string | null;
}

export const DEVICE_LOGS_UNAVAILABLE_MESSAGE = 'Logs are temporarily unavailable.';
export const DEVICE_LOGS_GENERIC_MESSAGE = "Couldn't load agent logs.";

/** `fetchRelay` throws this prefix for any non-200 that carried no GraphQL body (the edge proxy's 502). */
function isTransportFailure(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Relay fetch failed:');
}

/**
 * Chooses the UI from `extensions.code`, not from the message text. A non-200
 * while a search is active is the edge proxy rejecting the text (a WAF rule),
 * never a crash or a blank list.
 */
export function describeDeviceLogError(error: unknown, { hasSearch }: { hasSearch: boolean }): DeviceLogErrorInfo {
  if (isOfflineError(error)) {
    return { kind: 'offline', message: loadErrorProps(true, '').message, code: null };
  }
  const coded = getRelayErrorCode(error);
  switch (coded?.code) {
    case 'DEVICE_NOT_FOUND':
      return { kind: 'not-found', message: 'This device no longer exists.', code: coded.code };
    case 'VALIDATION_ERROR':
      return { kind: 'validation', message: coded.message || 'The request was rejected.', code: coded.code };
    case 'LOKI_QUERY_ERROR':
      return { kind: 'unavailable', message: DEVICE_LOGS_UNAVAILABLE_MESSAGE, code: coded.code };
    default:
      break;
  }
  if (!coded && hasSearch && isTransportFailure(error)) {
    return { kind: 'search-rejected', message: DEVICE_LOG_SEARCH_REJECTED_MESSAGE, code: null };
  }
  return { kind: 'generic', message: DEVICE_LOGS_GENERIC_MESSAGE, code: coded?.code ?? null };
}
