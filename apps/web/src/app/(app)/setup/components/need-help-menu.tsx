'use client';

import {
  CalendarIcon,
  HeadphoneIcon,
  PlayIcon,
  QuestionCircleIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuItem,
  ActionsMenuDropdown,
  Button,
  DropdownButton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { useOnboardingMeetingLink } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';
import { ContactSupportModal } from '@/app/components/shared/contact-support-modal';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { BookCallModal } from './book-call-modal';
import { IntroVideoModal } from './intro-video-modal';

type HelpSurface = 'intro' | 'call' | 'support' | null;

/**
 * The wizard footer's "Need Help?" menu, opening upwards: the intro clip, an
 * onboarding call and a support ticket. The first two are offered only once the
 * hub says they exist - a menu item that opens an empty modal helps nobody.
 *
 * The menu rows carry no second line (the design's "45 min, set up together")
 * because the lib's `ActionsMenuItem` has no description slot.
 *
 * On a phone the trigger is the question glyph alone, no button chrome and no
 * chevron, as the design draws it; the menu behind it is the same.
 */
export function NeedHelpMenu() {
  const [open, setOpen] = useState<HelpSurface>(null);
  const { video } = useWalkthroughVideoData();
  const { link } = useOnboardingMeetingLink();

  const items: ActionsMenuItem[] = [
    ...(video?.mainVideoUrl || video?.youtubeUrl
      ? [{ id: 'intro', label: 'Watch a 1-minute intro', icon: <PlayIcon />, onClick: () => setOpen('intro') }]
      : []),
    ...(link
      ? [{ id: 'call', label: 'Book an Onboarding Call', icon: <CalendarIcon />, onClick: () => setOpen('call') }]
      : []),
    { id: 'support', label: 'Contact Support', icon: <HeadphoneIcon />, onClick: () => setOpen('support') },
  ];

  const close = () => setOpen(null);

  return (
    <>
      <div className="sm:hidden">
        <ActionsMenuDropdown
          groups={[{ items }]}
          customTrigger={
            <Button variant="glyph" size="icon" aria-label="Need help?">
              <QuestionCircleIcon className="size-6" />
            </Button>
          }
          side="top"
          align="start"
          // Every item opens a modal: keep the menu from pulling focus back out of it.
          onCloseAutoFocus={event => event.preventDefault()}
        />
      </div>
      <div className="hidden sm:block">
        <DropdownButton
          variant="outline"
          size="default"
          icon={<QuestionCircleIcon />}
          label="Need Help?"
          items={items}
          side="top"
          align="start"
          onCloseAutoFocus={event => event.preventDefault()}
        />
      </div>
      <IntroVideoModal open={open === 'intro'} onClose={close} />
      <BookCallModal open={open === 'call'} onClose={close} />
      <ContactSupportModal
        open={open === 'support'}
        onOpenChange={isOpen => setOpen(isOpen ? 'support' : null)}
        title="Contact Support"
        submitLabel="Send"
        cancelLabel="Cancel"
      />
    </>
  );
}
