/**
 * reCAPTCHA Enterprise action tokens for the password signup, reset and download-link requests. The
 * edge firewall reads the `X-Recaptcha-Token` header itself and refuses those POSTs without a token
 * scoring 0.5 or more, so nothing on the backend sees or verifies it.
 *
 * Web only: the shells' CSP does not admit Google's script, and a key only answers for the domains
 * it lists, none of which is a shell origin. No site key (self-hosted OSS, local dev) sends nothing.
 */

import { isAppShell } from './platform';
import { runtimeEnv } from './runtime-config';

export const RECAPTCHA_TOKEN_HEADER = 'X-Recaptcha-Token';

/** The script never answering (blocked, offline) must not hold the form; the request goes without it. */
const TOKEN_TIMEOUT_MS = 10_000;

interface RecaptchaEnterprise {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

interface WindowWithRecaptcha {
  grecaptcha?: { enterprise?: RecaptchaEnterprise };
}

let scriptLoad: Promise<RecaptchaEnterprise> | null = null;

function siteKey(): string | undefined {
  if (typeof window === 'undefined' || isAppShell()) return undefined;
  return runtimeEnv.recaptchaSiteKey();
}

function loadScript(key: string): Promise<RecaptchaEnterprise> {
  if (scriptLoad) return scriptLoad;
  const script = document.createElement('script');
  const load = new Promise<RecaptchaEnterprise>((resolve, reject) => {
    // A load that never settles (a stalled request, `ready` never firing) would otherwise stay cached and hold
    // every later submit for the full timeout without ever loading again.
    const timer = setTimeout(() => reject(new Error('reCAPTCHA script timed out')), TOKEN_TIMEOUT_MS);
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => {
      const enterprise = (window as unknown as WindowWithRecaptcha).grecaptcha?.enterprise;
      if (!enterprise) {
        clearTimeout(timer);
        reject(new Error('reCAPTCHA script loaded without grecaptcha.enterprise'));
        return;
      }
      enterprise.ready(() => {
        clearTimeout(timer);
        resolve(enterprise);
      });
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('reCAPTCHA script failed to load'));
    };
    document.head.appendChild(script);
  });
  scriptLoad = load;
  // A blocked or stalled load is retried on the next submit instead of failing every later one.
  load.catch(() => {
    script.remove();
    if (scriptLoad === load) scriptLoad = null;
  });
  return load;
}

/**
 * Starts loading the script on the auth pages, so it has seen the visitor before the submit asks it
 * for a score; a cold load at submit time scores lower and adds a second to the request.
 */
export function preloadRecaptcha(): void {
  const key = siteKey();
  if (key) loadScript(key).catch(() => undefined);
}

/**
 * The header to send with one request: a fresh token per call, since each is single-use and expires
 * after two minutes. Empty when there is no key or no token could be had; the firewall decides then.
 */
export async function recaptchaHeaders(
  action: 'signup' | 'password_reset' | 'download_link',
): Promise<Record<string, string>> {
  const key = siteKey();
  if (!key) return {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await Promise.race([
      loadScript(key).then(enterprise => enterprise.execute(key, { action })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('reCAPTCHA timed out')), TOKEN_TIMEOUT_MS);
      }),
    ]);
    return token ? { [RECAPTCHA_TOKEN_HEADER]: token } : {};
  } catch (error) {
    console.warn('reCAPTCHA token unavailable:', error);
    return {};
  } finally {
    clearTimeout(timer);
  }
}
