'use client';

/**
 * HelpCenterAssistantRuntime: what the lib's "ask" surfaces need to offer THIS
 * app's chat (the "Ask Mingo" card beside a FAQ: `FaqSection`, the FAQs page,
 * the Trust Center's FAQ, the FAQ under a release or an onboarding guide).
 *
 * Nothing here is typed:
 *   - `available` is the launcher store's `canOpen` (an unlocked workspace with
 *     the drawer mounted), so a card never offers a chat that cannot open;
 *   - the name and glyph are the Mingo agent's own published config, read from
 *     the hub through the chat runtime's `aiAgentConfigUrl` (the request the
 *     "Meet Mingo" onboarding step already makes, cached per URL);
 *   - the questions come from the hub's general questions (`EP.askPrompts`),
 *     picked by the topic each FAQ passes;
 *   - a click goes to this app's own Mingo drawer through the launcher store,
 *     never to a chat the lib assumes: a question is sent in a fresh dialog, the
 *     launcher alone opens the drawer.
 *
 * With no name from the hub the lib renders no card: it invents no identity.
 */

import { EntityIcon } from '@flamingo-stack/openframe-frontend-core/components';
import { useEmptyStateConfig } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  type AssistantOpenRequest,
  type AssistantRuntime,
  AssistantRuntimeContext,
  useChatRuntime,
} from '@flamingo-stack/openframe-frontend-core/contexts';
import { type ReactNode, useMemo } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { EP } from './endpoints';

/** The agent the drawer talks to: its public slug on the hub (chat-admin source `agent-mingo`). */
const ASSISTANT_AGENT_SLUG = 'mingo';

function openMingo({ prompt }: AssistantOpenRequest): void {
  const launcher = useMingoLauncherStore.getState();
  if (prompt) launcher.sendToMingo(prompt);
  else launcher.setOpen(true);
}

export function HelpCenterAssistantRuntime({ children }: { children: ReactNode }) {
  const available = useMingoLauncherStore(state => state.canOpen);
  const agentConfigUrl = useChatRuntime()?.endpoints.aiAgentConfigUrl?.(ASSISTANT_AGENT_SLUG);
  const { config } = useEmptyStateConfig(agentConfigUrl, { enabled: Boolean(agentConfigUrl) });
  const name = config.name ?? null;
  const icon = config.icon ?? null;
  // One element per glyph, so the runtime value keeps one identity between renders.
  const iconNode = useMemo(
    () => (icon ? <EntityIcon icon={icon} size={32} className="size-full" /> : undefined),
    [icon],
  );

  const runtime = useMemo<AssistantRuntime>(
    () => ({ available, name, icon: iconNode, askPromptsUrl: EP.askPrompts, open: openMingo }),
    [available, name, iconNode],
  );
  return <AssistantRuntimeContext.Provider value={runtime}>{children}</AssistantRuntimeContext.Provider>;
}
