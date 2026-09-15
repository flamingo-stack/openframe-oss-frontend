'use client';

import { featureFlags, whenFeatureFlagsResolved } from '@/lib/feature-flags';

/**
 * The commands Guide Mode V2 ships. Guide Mode V3 (`ai-mingo-remote-tools`)
 * resolves its catalog through Hub MCP prompts, so under V3 this list is not a
 * subset to trim to — it is a stale snapshot of one, and the whole server-owned
 * catalog is what the agent can actually run.
 */
export const VISIBLE_SLASH_COMMAND_IDS: ReadonlySet<string> = new Set([
  'docs',
  'my-tickets',
  'open-ticket',
  'update-ticket',
]);

/** Path of MPH's slash-command catalog route, as proxied under `/content`. */
const COMMANDS_PATH = '/api/docs/commands';

/** Shape of the commands response — the subset this filter needs. */
export interface CommandsResponse {
  commands?: Array<{ id?: string }>;
}

/**
 * Trim the catalog to the V2 command set, or pass it through under V3.
 *
 * Returns the ORIGINAL object by reference when nothing was removed — that
 * identity is the caller's "leave the response alone" signal, so an untouched
 * catalog is never re-serialized (which would rewrite its headers for nothing).
 */
export function applySlashCommandVisibility(payload: CommandsResponse, remoteToolsEnabled: boolean): CommandsResponse {
  if (remoteToolsEnabled || !Array.isArray(payload.commands)) return payload;

  const commands = payload.commands.filter(cmd => cmd.id !== undefined && VISIBLE_SLASH_COMMAND_IDS.has(cmd.id));
  return commands.length === payload.commands.length ? payload : { ...payload, commands };
}

let installed = false;

function isCommandsRequest(input: RequestInfo | URL): boolean {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw, window.location.origin).pathname.endsWith(COMMANDS_PATH);
  } catch {
    return false;
  }
}

/**
 * Trim the server-owned command catalog down to the commands openframe ships,
 * unless Guide Mode V3 is on for this tenant.
 *
 * Sits on `fetch` because the request fires from a CHILD mount effect, before any
 * parent effect could gate it — hence the call at module load, next to
 * `setEmbedAuthAdapter`. Idempotent, so the wrapper can never stack on itself.
 */
export function installSlashCommandVisibilityFilter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    if (!response.ok || !isCommandsRequest(input)) return response;

    // Parsed off a clone, so any failure can return the untouched original: a
    // response-shape change upstream degrades to "no filtering", not to a broken chat.
    let payload: CommandsResponse;
    try {
      payload = (await response.clone().json()) as CommandsResponse;
    } catch {
      return response;
    }

    // Wait for the real flag value rather than reading the fallback. This
    // response is what `useSlashCommandRegistry` caches for the session, so a
    // guess made before the flags land is not a wrong frame — it is the catalog
    // the panel keeps until reload. See `whenFeatureFlagsResolved`.
    await whenFeatureFlagsResolved();

    const visiblePayload = applySlashCommandVisibility(payload, featureFlags.mingoRemoteTools.enabled());
    if (visiblePayload === payload) return response;

    // Headers rebuilt rather than copied — the original `Content-Length` no longer matches.
    return new Response(JSON.stringify(visiblePayload), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
