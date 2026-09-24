import type {
  CreateRemoteAccessRequestInput,
  RemoteAccessRequest,
  RemoteAccessRequestStatus,
} from '../types/remote-access';
import { mockRemoteAccessPolicyService } from './remote-access-policy-service';

/**
 * Remote-access approval backend surface (CU-86ajx03db). Two implementations:
 * `RemoteAccessApprovalApiService` (remote-access-approval-api-service.ts) for
 * the real approval API (CU-86ajx02gz) and the in-memory
 * `MockRemoteAccessApprovalService` below; `useRemoteAccessApprovalService`
 * picks one by the `remote-access-approval-api` flag.
 *
 * `onDecision` is the mock's push channel (its settle lever notifies
 * listeners); for the real API the decision arrives on the NATS notification
 * subject and the hook subscribes to it. `get` is the polling fallback both
 * flows keep for missed pushes.
 */
export interface IRemoteAccessApprovalService {
  /**
   * Create an approval request. The server keeps at most one open request per
   * device - a second create while one is open returns the existing request.
   */
  create(input: CreateRemoteAccessRequestInput): Promise<RemoteAccessRequest>;
  get(requestId: string): Promise<RemoteAccessRequest>;
  /** Technician cancels an open request -> REVOKED (client prompt closes). */
  revoke(requestId: string): Promise<void>;
  /** Subscribe to settle events for one request. Returns the unsubscribe. */
  onDecision(requestId: string, listener: (request: RemoteAccessRequest) => void): () => void;
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

const MOCK_LATENCY_MS = 350;
/** Client ack arrives shortly after create - PENDING -> DELIVERED. */
const MOCK_DELIVERY_MS = 1200;
/** Matches the fixed approval timeout (30 s, decision 2026-09-18). */
const MOCK_TIMEOUT_MS = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SETTLED: ReadonlySet<RemoteAccessRequestStatus> = new Set([
  'APPROVED',
  'DENIED',
  'TIMED_OUT',
  'REVOKED',
  'CANCELLED',
  'EXPIRED',
]);

export function isSettledRequestStatus(status: RemoteAccessRequestStatus): boolean {
  return SETTLED.has(status);
}

interface MockRequestEntry {
  request: RemoteAccessRequest;
  timers: ReturnType<typeof setTimeout>[];
  listeners: Set<(request: RemoteAccessRequest) => void>;
}

/**
 * In-memory stand-in for the approval API. Requests auto-move to DELIVERED and
 * auto-expire to TIMED_OUT on the spec's schedule; the end user's Allow/Decline
 * click has no real device to live on, so the dev controls on the awaiting
 * screen call {@link settle} to simulate it.
 */
class MockRemoteAccessApprovalService implements IRemoteAccessApprovalService {
  private requests = new Map<string, MockRequestEntry>();
  /** requestId of the open (unsettled) request per deviceId. */
  private openByDevice = new Map<string, string>();

  async create(input: CreateRemoteAccessRequestInput): Promise<RemoteAccessRequest> {
    await delay(MOCK_LATENCY_MS);

    const openId = this.openByDevice.get(input.deviceId);
    if (openId) {
      const open = this.requests.get(openId);
      if (open && !isSettledRequestStatus(open.request.status)) return { ...open.request };
    }

    // Per the CU-86ajx02gz contract, request creation resolves the policy mode
    // first: APPROVAL_REQUIRED publishes to the machine and waits; NOTIFY_ONLY
    // and SILENT_ACCESS auto-approve immediately (the machine gets session
    // events, not an approval prompt); DENY_ACCESS returns DENIED outright.
    const { effectiveMode: resolvedMode } = await mockRemoteAccessPolicyService.getDevicePolicy(
      input.deviceId,
      input.organizationId,
    );

    const now = Date.now();
    const request: RemoteAccessRequest = {
      requestId: `req-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      deviceId: input.deviceId,
      sessionKind: input.sessionKind,
      status: resolvedMode === 'DENY_ACCESS' ? 'DENIED' : resolvedMode === 'APPROVAL_REQUIRED' ? 'PENDING' : 'APPROVED',
      reason: input.reason,
      ticketId: input.ticketId,
      mode: resolvedMode,
      decisionSource: resolvedMode === 'APPROVAL_REQUIRED' ? null : 'POLICY',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + MOCK_TIMEOUT_MS).toISOString(),
    };
    const entry: MockRequestEntry = { request, timers: [], listeners: new Set() };
    this.requests.set(request.requestId, entry);

    // Only an attended request stays open (waits for the user's decision).
    if (request.status === 'PENDING') {
      this.openByDevice.set(input.deviceId, request.requestId);
      entry.timers.push(
        setTimeout(() => {
          if (entry.request.status === 'PENDING') {
            entry.request = { ...entry.request, status: 'DELIVERED', deliveredAt: new Date().toISOString() };
            this.notify(entry);
          }
        }, MOCK_DELIVERY_MS),
        setTimeout(() => this.settle(request.requestId, 'TIMED_OUT'), MOCK_TIMEOUT_MS),
      );
    }

    return { ...request };
  }

  async get(requestId: string): Promise<RemoteAccessRequest> {
    await delay(MOCK_LATENCY_MS);
    const entry = this.requests.get(requestId);
    if (!entry) throw new Error('Approval request not found');
    return { ...entry.request };
  }

  async revoke(requestId: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    this.settle(requestId, 'REVOKED');
  }

  onDecision(requestId: string, listener: (request: RemoteAccessRequest) => void): () => void {
    const entry = this.requests.get(requestId);
    if (!entry) return () => {};
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }

  /**
   * Settle an open request - the mock's stand-in for the end user's decision
   * (and for the server's timeout sweep). No-op once settled, mirroring the
   * API's 409 on a repeat decision.
   */
  settle(
    requestId: string,
    status: Extract<RemoteAccessRequestStatus, 'APPROVED' | 'DENIED' | 'TIMED_OUT' | 'REVOKED'>,
  ): void {
    const entry = this.requests.get(requestId);
    if (!entry || isSettledRequestStatus(entry.request.status)) return;
    entry.request = {
      ...entry.request,
      status,
      decisionSource: status === 'TIMED_OUT' ? 'TIMEOUT' : status === 'REVOKED' ? 'TECHNICIAN' : 'USER',
      resolvedAt: new Date().toISOString(),
    };
    for (const timer of entry.timers) clearTimeout(timer);
    entry.timers = [];
    if (this.openByDevice.get(entry.request.deviceId) === requestId) {
      this.openByDevice.delete(entry.request.deviceId);
    }
    this.notify(entry);
  }

  private notify(entry: MockRequestEntry): void {
    const snapshot = { ...entry.request };
    for (const listener of entry.listeners) listener(snapshot);
  }
}

export const mockRemoteAccessApprovalService: IRemoteAccessApprovalService = new MockRemoteAccessApprovalService();

/**
 * The mock's decision lever, exported ONLY for the simulation controls on the
 * awaiting screen. The real service has no such method - the decision comes
 * from the end user's machine - so this is a no-op once the mock is gone.
 */
export const mockRemoteAccessDecision = (requestId: string, status: 'APPROVED' | 'DENIED' | 'TIMED_OUT'): void => {
  if (mockRemoteAccessApprovalService instanceof MockRemoteAccessApprovalService) {
    mockRemoteAccessApprovalService.settle(requestId, status);
  }
};
