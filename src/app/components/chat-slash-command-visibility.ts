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

/** Resolve the request URL from any `fetch` input form, or `null` if it is not parseable. */
function requestUrl(input: RequestInfo | URL): URL | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
}

function isCommandsRequest(input: RequestInfo | URL): boolean {
  return requestUrl(input)?.pathname.endsWith(COMMANDS_PATH) ?? false;
}

/**
 * Install the filter. Idempotent (and HMR-safe) — a second call is a no-op, so
 * the wrapper can never stack on top of itself.
 *
 * Call at module load, next to `setEmbedAuthAdapter`: the chat's command
 * requests fire from CHILD mount effects, which run before any parent effect.
 */
export function installSlashCommandVisibilityFilter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    if (!response.ok || !isCommandsRequest(input)) return response;

    // Read the body off a clone: on any parse failure we still have the
    // untouched original to return, so a response-shape change upstream
    // degrades to "no filtering", never to a broken chat.
    let payload: CommandsResponse;
    try {
      payload = (await response.clone().json()) as CommandsResponse;
    } catch {
      return response;
    }
    if (!Array.isArray(payload.commands)) return response;

    const commands = payload.commands.filter(cmd => cmd.id !== undefined && VISIBLE_SLASH_COMMAND_IDS.has(cmd.id));
    if (commands.length === payload.commands.length) return response;

    // `Content-Length` from the original headers would now be wrong; rebuild
    // from the status line + content type only.
    return new Response(JSON.stringify({ ...payload, commands }), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
