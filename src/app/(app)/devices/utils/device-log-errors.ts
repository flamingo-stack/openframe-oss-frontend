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

/**
 * Whether sending the same request again can succeed: an outage, not an answer
 * about the request. Offline is not — it waits for the link to return instead.
 */
export function isRetryableDeviceLogError(kind: DeviceLogErrorKind): boolean {
  return kind === 'unavailable' || kind === 'generic';
}

const DEVICE_LOGS_UNAVAILABLE_MESSAGE = 'Logs are temporarily unavailable.';
const DEVICE_LOGS_GENERIC_MESSAGE = "Couldn't load agent logs.";

/** The edge proxy's bodiless 502 only: other statuses and the auth blip share the prefix but are outages. */
function isProxyRejection(error: unknown): boolean {
  return error instanceof Error && /^Relay fetch failed: 502\b/.test(error.message);
}

/**
 * Chooses the UI from `extensions.code`, not from the message text. A bodiless
 * 502 while a search is active is the edge proxy rejecting the text (a WAF rule),
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
  if (!coded && hasSearch && isProxyRejection(error)) {
    return { kind: 'search-rejected', message: DEVICE_LOG_SEARCH_REJECTED_MESSAGE, code: null };
  }
  return { kind: 'generic', message: DEVICE_LOGS_GENERIC_MESSAGE, code: coded?.code ?? null };
}
