'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { registerShellNavigator } from '@/lib/shell-navigator';

/**
 * Hands the app router to code that runs outside React (`navigateInApp`), so the
 * dialog-open seam can navigate from a notification click or a desktop OS toast
 * without a full page load. Mounted once, in the `(app)` layout; renders nothing.
 */
export function ShellNavigatorRegistrar() {
  const router = useRouter();
  useEffect(() => registerShellNavigator(href => router.push(href)), [router]);
  return null;
}
