'use client';

import { Refresh02VrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDesktopUpdateStore } from '@/stores/desktop-update-store';

interface SidebarUpdateButtonProps {
  /** The sidebar is the 56px rail — there is room for the glyph and nothing else. */
  minimized: boolean;
}

/**
 * "An update is ready" in the navigation, passed to the core sidebar as
 * `topSlot` so it appears in the rail AND in the mobile burger menu. Clicking it
 * reopens the update modal, which is the whole reason it exists: dismissing the
 * modal must not strand the user with no way back to it.
 *
 * Desktop-shell only in practice — nothing else populates the store — so this
 * renders nothing on mobile and the web.
 */
export function SidebarUpdateButton({ minimized }: SidebarUpdateButtonProps) {
  const available = useDesktopUpdateStore(state => state.available);
  const version = useDesktopUpdateStore(state => state.version);
  const openModal = useDesktopUpdateStore(state => state.openModal);

  if (!available || !version) return null;

  const label = `Update to v${version}`;

  return (
    // Expanded: the same 16px inset the nav rows carry, so the button sits on
    // the sidebar's grid rather than beside it. The rail gets 4px, which is what
    // squares the 48px `icon` button inside 56px.
    <div className={minimized ? 'flex justify-center p-1' : 'p-[var(--spacing-system-m)]'}>
      <Button
        variant="accent"
        size={minimized ? 'icon' : 'default'}
        fullWidth={!minimized}
        onClick={openModal}
        // With the label gone the glyph carries the whole message, so the
        // accessible name has to come from somewhere; `title` also gives the
        // rail the hover tooltip every other collapsed row gets.
        aria-label={minimized ? label : undefined}
        title={minimized ? label : undefined}
        leftIcon={minimized ? undefined : <Refresh02VrIcon />}
      >
        {minimized ? <Refresh02VrIcon /> : label}
      </Button>
    </div>
  );
}
