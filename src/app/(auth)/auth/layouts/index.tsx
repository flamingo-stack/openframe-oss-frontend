'use client';

import { AuthBenefitsSection } from '../components/benefits-section';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Unified layout wrapper for all OpenFrame auth pages
 * Provides consistent 50/50 split with proper responsive behavior and vertical centering
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-ods-bg lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Left Side - Auth Content (50% width) */}
      <div className="w-full lg:h-full lg:w-1/2 lg:overflow-y-auto">
        <div className="flex min-h-screen flex-col justify-center gap-10 p-6 lg:min-h-full lg:p-20">{children}</div>
      </div>

      {/* Right Side - Benefits Section (50% width) */}
      <div className="w-full lg:h-full lg:w-1/2">
        <AuthBenefitsSection />
      </div>
    </div>
  );
}
