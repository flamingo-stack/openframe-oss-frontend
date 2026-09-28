import type {
  RecordingChatMessage,
  RecordingDetail,
  RecordingSegment,
  RecordingSummary,
} from '../types/session-recording';

/**
 * Thrown by `downloadSegment` when a file's bytes cannot be fetched - it has
 * no download URL yet, or the storage request failed. The player page renders
 * its "Session recording unavailable" state when no file of the session loads.
 */
export class RecordingUnavailableError extends Error {
  constructor(message = 'Session recording unavailable') {
    super(message);
    this.name = 'RecordingUnavailableError';
  }
}

/**
 * Session-recordings backend surface: the in-memory mock below, or the
 * openframe-saas-api client (session-recordings-api-service.ts), picked by
 * `useSessionRecordingsService`.
 */
export interface ISessionRecordingsService {
  /** Whether a recording can be removed from the tab; the API keeps them until retention does. */
  readonly canDelete: boolean;
  /** The device's remote sessions, newest first. */
  list(deviceId: string): Promise<RecordingSummary[]>;
  get(recordingId: string): Promise<RecordingDetail>;
  /** Fetch one file's raw `.mcrec` bytes. Throws {@link RecordingUnavailableError}. */
  downloadSegment(segment: RecordingSegment): Promise<ArrayBuffer>;
  delete(recordingId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

const MOCK_LATENCY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MOCK_CHAT: RecordingChatMessage[] = [
  {
    id: 'c1',
    author: 'Anthony Reed',
    fromTechnician: false,
    sentAt: '2026-09-05T14:47:05Z',
    body: 'Computer work slow',
  },
  {
    id: 'c2',
    author: 'Roman Smith',
    fromTechnician: true,
    sentAt: '2026-09-05T14:47:20Z',
    body: 'Hi Anthony, thanks for approving the session. When did this start?',
  },
  {
    id: 'c3',
    author: 'Anthony Reed',
    fromTechnician: false,
    sentAt: '2026-09-05T14:47:41Z',
    body: 'Since this morning. Everything freezes when I open Excel',
  },
  {
    id: 'c4',
    author: 'Roman Smith',
    fromTechnician: true,
    sentAt: '2026-09-05T14:48:02Z',
    body: "Got it, opening Task Manager to check what's eating resources",
  },
  { id: 'c5', author: 'Anthony Reed', fromTechnician: false, sentAt: '2026-09-05T14:48:10Z', body: 'ok' },
  {
    id: 'c6',
    author: 'Roman Smith',
    fromTechnician: true,
    sentAt: '2026-09-05T14:49:31Z',
    body: "Found it, an update process is stuck at 99% CPU. I'll need admin rights to restart it",
  },
  { id: 'c7', author: 'Anthony Reed', fromTechnician: false, sentAt: '2026-09-05T14:49:44Z', body: 'Sure, go ahead' },
  {
    id: 'c8',
    author: 'Roman Smith',
    fromTechnician: true,
    sentAt: '2026-09-05T14:51:12Z',
    body: 'Done, killed the process and paused updates until tonight. Try Excel now',
  },
  {
    id: 'c9',
    author: 'Anthony Reed',
    fromTechnician: false,
    sentAt: '2026-09-05T14:51:40Z',
    body: 'Wow, much faster. Thank you!',
  },
  {
    id: 'c10',
    author: 'Roman Smith',
    fromTechnician: true,
    sentAt: '2026-09-05T14:52:01Z',
    body: "You're welcome. I'll close the session, ping us if it comes back",
  },
];

interface MockRecordingSeed extends RecordingSummary {
  /** The session's files come from `recordingId` in `get`; the mock stores none. */
  detail: Omit<RecordingDetail, keyof RecordingSummary | 'chat' | 'segments'>;
}

/**
 * Deterministic ids so deep links survive reloads. Every device shows the same
 * set - the mock has no real per-device data.
 */
function buildSeeds(deviceId: string): MockRecordingSeed[] {
  const base: Array<Partial<RecordingSummary> & { id: string; detail: MockRecordingSeed['detail'] }> = [
    {
      id: 'rec-processing',
      startedAt: '2026-09-09T16:32:00Z',
      durationMs: null,
      sizeBytes: null,
      processing: true,
      detail: { hostname: 'workstation-23.acme.local', organization: { id: 'org-1', name: 'Acme Logistics Co. (HQ)' } },
    },
    {
      id: 'rec-desktop-long',
      startedAt: '2026-09-08T11:05:00Z',
      durationMs: 23 * 60_000 + 49_000,
      sizeBytes: 110 * 1024 * 1024,
      detail: {
        hostname: 'workstation-23.acme.local',
        organization: { id: 'org-1', name: 'Acme Logistics Co. (HQ)' },
        resolution: '1280 × 720',
        loggedInUser: 'John Smith',
      },
    },
    {
      id: 'rec-desktop-short',
      startedAt: '2026-09-05T14:47:00Z',
      durationMs: 30_500,
      sizeBytes: 2_454_931,
      detail: {
        hostname: 'workstation-23.acme.local',
        organization: { id: 'org-1', name: 'Acme Logistics Co. (HQ)' },
        resolution: '1280 × 720',
        loggedInUser: 'John Smith',
      },
    },
    {
      id: 'rec-terminal',
      startedAt: '2026-09-02T09:12:00Z',
      durationMs: 4 * 60_000 + 12_000,
      sizeBytes: 5_424,
      protocol: 1,
      detail: {
        hostname: 'workstation-23.acme.local',
        organization: { id: 'org-1', name: 'Acme Logistics Co. (HQ)' },
        loggedInUser: 'John Smith',
      },
    },
  ];

  return base.map(seed => ({
    deviceId,
    startedAt: seed.startedAt ?? new Date().toISOString(),
    durationMs: seed.durationMs ?? null,
    sizeBytes: seed.sizeBytes ?? null,
    protocol: seed.protocol ?? 2,
    processing: seed.processing ?? false,
    recordingId: seed.processing ? null : seed.id,
    employee: { name: 'Roman Smith', role: 'Admin' },
    id: seed.id,
    detail: seed.detail,
  }));
}

class MockSessionRecordingsService implements ISessionRecordingsService {
  readonly canDelete = true;

  /** Keyed by deviceId; deletes mutate the array so invalidation shows. */
  private store = new Map<string, MockRecordingSeed[]>();

  private forDevice(deviceId: string): MockRecordingSeed[] {
    let seeds = this.store.get(deviceId);
    if (!seeds) {
      seeds = buildSeeds(deviceId);
      this.store.set(deviceId, seeds);
    }
    return seeds;
  }

  private findById(recordingId: string): MockRecordingSeed | undefined {
    for (const seeds of this.store.values()) {
      const found = seeds.find(s => s.id === recordingId);
      if (found) return found;
    }
    return undefined;
  }

  async list(deviceId: string): Promise<RecordingSummary[]> {
    await delay(MOCK_LATENCY_MS);
    return this.forDevice(deviceId).map(({ detail: _detail, ...summary }) => ({ ...summary }));
  }

  async get(recordingId: string): Promise<RecordingDetail> {
    await delay(MOCK_LATENCY_MS);
    // A deep link can arrive before any list was fetched - seed a default
    // device so `get` still resolves.
    if (this.store.size === 0) this.forDevice('mock-device');
    const seed = this.findById(recordingId) ?? this.forDevice('mock-device').find(s => !s.processing);
    if (!seed) throw new Error('Recording not found');
    const { detail, ...summary } = seed;
    // No storage behind the mock: its files have no URL, so the page shows the
    // unavailable state and the dev loader can feed local files instead.
    const segments = summary.recordingId ? [{ id: summary.recordingId, sizeBytes: summary.sizeBytes }] : [];
    return { ...summary, ...detail, segments, chat: MOCK_CHAT };
  }

  async downloadSegment(segment: RecordingSegment): Promise<ArrayBuffer> {
    await delay(MOCK_LATENCY_MS);
    if (!segment.downloadUrl) throw new RecordingUnavailableError();
    const res = await fetch(segment.downloadUrl);
    if (!res.ok) throw new RecordingUnavailableError();
    return res.arrayBuffer();
  }

  async delete(recordingId: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    for (const [deviceId, seeds] of this.store.entries()) {
      this.store.set(
        deviceId,
        seeds.filter(s => s.id !== recordingId),
      );
    }
  }
}

export const sessionRecordingsService: ISessionRecordingsService = new MockSessionRecordingsService();
