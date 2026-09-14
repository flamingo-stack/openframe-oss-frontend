'use client';

export const VISIBLE_SLASH_COMMAND_IDS: ReadonlySet<string> = new Set([
  'docs',
  'my-tickets',
  'open-ticket',
  'update-ticket',
]);

/** Path of MPH's slash-command catalog route, as proxied under `/content`. */
const COMMANDS_PATH = '/api/docs/commands';

/** Shape of the commands response — the subset this filter needs. */
interface CommandsResponse {
  commands?: Array<{ id?: string }>;
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
 * Trim the server-owned command catalog down to the commands openframe ships.
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
    if (!Array.isArray(payload.commands)) return response;

    const commands = payload.commands.filter(cmd => cmd.id !== undefined && VISIBLE_SLASH_COMMAND_IDS.has(cmd.id));
    if (commands.length === payload.commands.length) return response;

    // Headers rebuilt rather than copied — the original `Content-Length` no longer matches.
    return new Response(JSON.stringify({ ...payload, commands }), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
