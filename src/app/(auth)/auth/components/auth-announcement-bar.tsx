'use client';

import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components';
import { type EndpointsRuntime, EndpointsRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { useEffect, useRef } from 'react';
import { isSaasSharedMode } from '@/lib/app-mode';
import { HUB_PUBLIC_API } from '@/lib/hub-public-api';

const HUB_ENDPOINTS: EndpointsRuntime = {
  announcementsUrl: `${HUB_PUBLIC_API}/announcements/active`,
  accessCode: {
    validateUrl: `${HUB_PUBLIC_API}/validate-access-code`,
    consumeUrl: `${HUB_PUBLIC_API}/consume-access-code`,
  },
  contactUrl: `${HUB_PUBLIC_API}/contact`,
};

const ANNOUNCEMENT_HEIGHT_VAR = '--announcement-h';

/**
 * The hub announcement above the auth pages of the shared-auth host, the one bar those pages
 * have. Read straight from the hub's public endpoint, like the waitlist form beside it. The auth
 * shells size themselves to the viewport, so the bar's live height is published as
 * `--announcement-h` on <body> and `globals.css` gives the shells what is left.
 */
export function AuthAnnouncementBar() {
  const enabled = isSaasSharedMode();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const body = document.body;
    const publish = () => body.style.setProperty(ANNOUNCEMENT_HEIGHT_VAR, `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      body.style.removeProperty(ANNOUNCEMENT_HEIGHT_VAR);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={ref}>
      <EndpointsRuntimeContext.Provider value={HUB_ENDPOINTS}>
        <AnnouncementBar />
      </EndpointsRuntimeContext.Provider>
    </div>
  );
}
