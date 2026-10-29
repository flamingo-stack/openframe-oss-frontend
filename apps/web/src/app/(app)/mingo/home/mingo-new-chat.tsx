'use client';

import { MingoLogoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
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
 * The greeting and the button carry the same two-colour Mingo mark, a glyph of the
 * library's, so both are drawn from the first frame (the agent's identity icon, read from
 * the server, left the greeting's box empty until it came).
 *
 * On a phone, reached from the chat list over a page (`outsidePage`), "Back" leads back
 * there, as a desktop page's back button does; out of the flow, so the greeting stays put.
 */
export function MingoNewChat() {
  const greeting = useGreeting();
  const phone = useMdUp() === false;
  const outsidePage = useMingoSheetStore(s => s.outsidePage);
  const back = useSafeBack(outsidePage ?? routes.dashboard);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-[var(--spacing-system-l)] py-[var(--spacing-system-xl)] text-center">
      {phone && outsidePage && (
        <BackButton onClick={back} className="absolute left-[var(--spacing-system-l)] top-[var(--spacing-system-xs)]" />
      )}
      <div className="flex items-center justify-center gap-[var(--spacing-system-m)]">
        <MingoLogoIcon className="size-8 shrink-0 content-md:size-10" aria-hidden="true" />
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
        leftIcon={<MingoLogoIcon />}
        className="mt-[var(--spacing-system-l)]"
      >
        What to ask Mingo?
      </Button>
    </div>
  );
}
