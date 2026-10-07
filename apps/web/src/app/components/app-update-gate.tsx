'use client';

import { type ReactNode, useEffect } from 'react';
import { onAppResume } from '@/lib/native-shell';
import { isMobileShell } from '@/lib/platform';
import { refreshVersionPolicy, useAppUpdateStore } from '@/lib/version-check';
import { UpdateAvailableModal } from './update-available-modal';
import { UpdateRequiredScreen } from './update-required-screen';

/**
 * Mobile force-update (`version-check.ts`). Fetches the version policy on cold
 * start and on every foreground resume, and once this bundle is refused renders
 * the blocking screen in place of everything below it — the NATS socket, the
 * biometric unlock gate and the login pages included. Children render untouched
 * on the web and desktop, where neither signal ever fires.
 */
export function AppUpdateGate({ children }: { children: ReactNode }) {
  const required = useAppUpdateStore(s => s.required !== null);

  useEffect(() => {
    if (!isMobileShell()) return undefined;
    void refreshVersionPolicy();
    return onAppResume(() => void refreshVersionPolicy(), 'Version Check');
  }, []);

  if (required) return <UpdateRequiredScreen />;

  return (
    <>
      {children}
      <UpdateAvailableModal />
    </>
  );
}

/**
 * Renders its children only while the app is usable. For root-level chrome that
 * sits outside `AppUpdateGate` (toasts, the offline banner): a request refused
 * with a 426 still fails into its caller's `onError` toast, and that toast must
 * not land on top of the screen telling the user why.
 */
export function HiddenWhileUpdateRequired({ children }: { children: ReactNode }) {
  const required = useAppUpdateStore(s => s.required !== null);
  return required ? null : children;
}
