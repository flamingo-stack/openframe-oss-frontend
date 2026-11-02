'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { BackButton, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { useGreeting } from './mingo-home-greeting';

/**
 * Mingo's home (`/mingo`), what "New chat" opens: the greeting in the middle of the page
 * and "What to ask Mingo?" under it (the full chat with its suggestions), and under the
 * page the shell's docked composer with Mingo's quick actions over it
 * (`MingoDockQuickActions`), always on a new chat. The fleet overview is the dashboard's
 * (`MingoDashboard`).
 *
 * The greeting and the button carry Mingo's mark from its identity (`AgentMark`), as every
 * Mingo icon does: one icon, set on the server, the same everywhere. Until the identities
 * land both keep their mark's box, so nothing moves when it is drawn.
 *
 * On a phone, reached from the chat list over a page (`newChatPage`), "Back" leads back
 * there with the list open over it again, the screen "Start New Chat" was pressed on, as a
 * desktop page's back button returns to the page before; out of the flow, so the greeting
 * stays put.
 */
export function MingoNewChat() {
  const greeting = useGreeting();
  const phone = useMdUp() === false;
  const newChatPage = useMingoSheetStore(s => s.newChatPage);
  const showListAfterNavigation = useMingoSheetStore(s => s.showListAfterNavigation);
  const toPage = useSafeBack(newChatPage ?? routes.dashboard);
  const back = () => {
    showListAfterNavigation();
    toPage();
  };

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-[var(--spacing-system-l)] py-[var(--spacing-system-xl)] text-center">
      {phone && newChatPage && (
        <BackButton onClick={back} className="absolute left-[var(--spacing-system-l)] top-[var(--spacing-system-xs)]" />
      )}
      <div className="flex items-center justify-center gap-[var(--spacing-system-m)]">
        <AgentMark agent="mingo" className="size-8 shrink-0 content-md:size-10" />
        <h1 className="min-w-0 break-words text-ods-text-primary text-h2">{greeting}</h1>
      </div>
      <p className="mt-[var(--spacing-system-m)] text-ods-text-primary text-h4">
        What needs doing across your fleet today?
      </p>
      <p className="mt-[var(--spacing-system-xs)] max-w-[560px] text-ods-text-secondary text-h6">
        Start with a quick action, or tell Mingo what needs to happen across your devices.
      </p>
      <Button
        variant="outline"
        href={routes.mingo.whatToAsk}
        leftIcon={<AgentMark agent="mingo" className="size-5" />}
        className="mt-[var(--spacing-system-l)]"
      >
        What to ask Mingo?
      </Button>
    </div>
  );
}
