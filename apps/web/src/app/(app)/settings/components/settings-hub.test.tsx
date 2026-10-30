/**
 * The settings hub's "Log Out": an OSS tenant's only one on a desktop (no user cell in the
 * header, the burger menu is the phone's), so it stays there; the Mingo-first shell logs out
 * from its account menu, and its settings page has none.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsHub } from './settings-hub';

const mode = vi.hoisted(() => ({ oss: true }));

vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isOssTenantMode: () => mode.oss,
}));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlagGate: () => 'off' }));
vi.mock('@/app/hooks/use-billing-access-gate', () => ({ useBillingAccessGate: () => 'denied' }));
vi.mock('@/app/hooks/use-is-mobile-shell', () => ({ useIsMobileShell: () => false }));
vi.mock('@/app/(auth)/auth/stores', () => ({
  useAuthStore: (selector: (state: { user: null; fetchFullProfile: () => void }) => unknown) =>
    selector({ user: null, fetchFullProfile: () => {} }),
}));
// The cards have tests of their own (and read the session); here, only the page's own controls.
vi.mock('./account-settings-card', () => ({ AccountSettingsCard: () => null }));
vi.mock('./biometric-login-card', () => ({ BiometricLoginCard: () => null }));
vi.mock('./setting-menu-item', () => ({ SettingMenuItem: () => null }));
// Relay modals (the `graphql` tag needs the compiler's transform), closed without a user.
vi.mock('./edit-profile-modal', () => ({ EditProfileModal: () => null }));
vi.mock('./email-verification-modal', () => ({ EmailVerificationModal: () => null }));
vi.mock('./email-verification-banner', () => ({ EmailVerificationBanner: () => null }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const logOutButton = () => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Log Out');

describe('SettingsHub Log Out', () => {
  it("is on an OSS tenant's settings page", () => {
    mode.oss = true;
    act(() => root.render(<SettingsHub />));
    expect(logOutButton()).toBeDefined();
  });

  it("is not on the Mingo-first shell's: its account menu logs out", () => {
    mode.oss = false;
    act(() => root.render(<SettingsHub />));
    expect(container.textContent).toContain('Settings');
    expect(logOutButton()).toBeUndefined();
  });
});
