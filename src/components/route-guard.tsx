'use client';

import { usePathname } from 'next/navigation';
import { isRouteAllowedInCurrentMode } from '../lib/app-mode';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Route guard component that handles route protection for static export
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();

  if (!isRouteAllowedInCurrentMode(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ods-bg">
        <div className="text-center">
          <h1 className="mb-4 text-ods-text-primary text-h2">Access restricted</h1>
          <p className="text-ods-text-secondary">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
