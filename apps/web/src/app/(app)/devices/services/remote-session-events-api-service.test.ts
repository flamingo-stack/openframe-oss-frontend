/**
 * The recording page asks for the rows it lists, viewers included, and tells a
 * colleague watching from the host watching their own session in a second tab.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  RemoteSessionActorKind,
  RemoteSessionEventType,
  RemoteSessionViewerLeftReason,
} from '@/generated/schema-enums';
import { fetchSessionEventsPage } from './remote-session-events-api-service';

const relay = vi.hoisted(() => ({ fetchQuery: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
vi.mock('@/lib/relay/commit-mutation', () => ({ commitMutationPromise: vi.fn() }));

function viewerRow(type: RemoteSessionEventType, userId: string, name: string, leftReason: string | null = null) {
  return {
    id: `${type}-${userId}`,
    type,
    at: '2026-11-16T11:09:00.000Z',
    offsetMs: 60_000,
    actor: { kind: RemoteSessionActorKind.VIEWER, userId, name },
    label: null,
    byteCount: null,
    toMonitorId: null,
    endReason: null,
    holdReason: null,
    leftReason,
  };
}

function answer(nodes: unknown[], technicianId = 'user-host') {
  relay.fetchQuery.mockReturnValueOnce({
    toPromise: () =>
      Promise.resolve({
        remoteSessionRecording: {
          session: {
            technicianId,
            events: { edges: nodes.map(node => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } },
          },
        },
      }),
  });
}

describe('fetchSessionEventsPage', () => {
  it('asks for the viewer rows with the rest', async () => {
    answer([]);
    await fetchSessionEventsPage('recording-1', null);
    const { types } = relay.fetchQuery.mock.calls[0]?.[2] as { types: RemoteSessionEventType[] };
    expect(types).toEqual(
      expect.arrayContaining([RemoteSessionEventType.VIEWER_JOINED, RemoteSessionEventType.VIEWER_LEFT]),
    );
  });

  it("lists a colleague's watching and leaves out the host's own", async () => {
    answer([
      viewerRow(RemoteSessionEventType.VIEWER_JOINED, 'user-host', 'Roman Smith'),
      viewerRow(RemoteSessionEventType.VIEWER_JOINED, 'user-anna', 'Anna Lee'),
      viewerRow(RemoteSessionEventType.VIEWER_LEFT, 'user-anna', 'Anna Lee', RemoteSessionViewerLeftReason.LEFT),
      viewerRow(
        RemoteSessionEventType.VIEWER_LEFT,
        'user-host',
        'Roman Smith',
        RemoteSessionViewerLeftReason.SESSION_ENDED,
      ),
    ]);
    const page = await fetchSessionEventsPage('recording-1', null);
    expect(page.events.map(({ title, detail }) => `${title}: ${detail}`)).toEqual([
      'Viewer joined: Anna Lee',
      'Viewer left: Anna Lee',
    ]);
    expect(page.viewersAtEnd).toEqual([]);
  });

  it('hands over who was still watching at the end', async () => {
    answer([
      viewerRow(
        RemoteSessionEventType.VIEWER_LEFT,
        'user-anna',
        'Anna Lee',
        RemoteSessionViewerLeftReason.SESSION_ENDED,
      ),
    ]);
    await expect(fetchSessionEventsPage('recording-1', null)).resolves.toEqual({
      events: [],
      viewersAtEnd: ['Anna Lee'],
      nextCursor: null,
    });
  });
});
