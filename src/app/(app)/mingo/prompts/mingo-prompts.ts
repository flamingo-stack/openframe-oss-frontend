/**
 * Central registry of the prompts Mingo is launched with from across the app.
 * Each key is a `MingoPromptSource` - the place the chat was invoked from (an
 * EmptyState "Ask Mingo about X" button today). Keeping every prompt here means
 * copy lives in one place and new entry points are a one-line addition.
 *
 * These launch Mingo's GUIDE mode, which supports slash commands (backed by the
 * runtime's `commandsUrl` / `/api/docs/commands`). Each source fires the
 * `/getting-started display "<id>"` command with the getting-started card id for
 * that section, so the user gets the interactive getting-started walkthrough for
 * the area they're looking at.
 */

export type MingoPromptSource =
  | 'queries'
  | 'customers'
  | 'policies'
  | 'scripts'
  | 'script-schedules'
  | 'logs'
  | 'devices'
  | 'tickets';

/**
 * getting-started card id per invocation source. Some sections intentionally
 * share a card (queries/policies, scripts/script-schedules). Edit ids here only.
 */
const GETTING_STARTED_CARD_IDS: Record<MingoPromptSource, string> = {
  customers: 'd3b5baad-7059-4f4e-936d-25643d085694',
  devices: '680774a5-cadd-49fd-87c4-115f38341e69',
  scripts: '015ca78c-4387-47e8-8db3-3d1bbe177dd9',
  'script-schedules': '015ca78c-4387-47e8-8db3-3d1bbe177dd9',
  policies: '37820f75-ec6b-4a70-becf-c788faad8be2',
  queries: '37820f75-ec6b-4a70-becf-c788faad8be2',
  logs: 'ce873865-49ba-4124-869e-fccaa5528f85',
  tickets: '4a750ff7-b36e-4451-adfc-7df334a53283',
};

/** One prompt per invocation source: the getting-started slash command. */
export function getMingoPrompt(source: MingoPromptSource): string {
  return `/getting-started display "${GETTING_STARTED_CARD_IDS[source]}"`;
}
