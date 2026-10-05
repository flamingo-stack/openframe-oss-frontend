import { describe, expect, it } from 'vitest';
import {
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  MOBILE_APP_INSTALL_HOST_PATH,
  MOBILE_APP_INSTALL_URL,
  resolveMobileStoreUrl,
} from './mobile-app-links';

/**
 * The install URL is the one string in this repo that genuinely cannot change: it is
 * printed into a QR code that also exists on paper, and that code is committed as path
 * data in `components/mobile-app-qr.tsx`. Renaming `routes.mobileApp` otherwise compiles
 * cleanly and silently points every printed code at a dead URL, so: if this fails,
 * REGENERATE THE QR — do not update the expectation.
 *
 * It pins this half only. A QR regenerated from a DIFFERENT url still passes, because
 * nothing here decodes the path data.
 */
describe('MOBILE_APP_INSTALL_URL', () => {
  it('is exactly what the committed QR path data encodes', () => {
    expect(MOBILE_APP_INSTALL_URL).toBe('https://openframe.ai/mobile');
  });

  it('prints without its scheme', () => {
    expect(MOBILE_APP_INSTALL_HOST_PATH).toBe('openframe.ai/mobile');
  });
});

/** Why these branches exist at all, and why none of them is redundant: see the function. */
describe('resolveMobileStoreUrl', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

  it('sends iOS devices to the App Store and Android to Play', () => {
    expect(resolveMobileStoreUrl(IPHONE, 5)).toBe(APP_STORE_URL);
    expect(resolveMobileStoreUrl(ANDROID, 5)).toBe(GOOGLE_PLAY_URL);
  });

  it('reads a touch-capable Macintosh as the iPad it is', () => {
    // iPadOS 13+ Safari requests desktop sites by default and sends a Mac user agent.
    // `maxTouchPoints` is the only thing separating it from a real Mac, and it is a
    // browser API — which is why no server-side rule can make this call.
    expect(resolveMobileStoreUrl(MAC, 5)).toBe(APP_STORE_URL);
    expect(resolveMobileStoreUrl(MAC, 0)).toBeNull();
  });

  it('keeps desktop visitors on the page, so they can scan the code', () => {
    expect(resolveMobileStoreUrl(WINDOWS, 0)).toBeNull();
    // A touchscreen Windows laptop is still a desktop: no Apple or Android token.
    expect(resolveMobileStoreUrl(WINDOWS, 10)).toBeNull();
  });
});
