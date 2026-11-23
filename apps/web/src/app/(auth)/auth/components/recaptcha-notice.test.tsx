/**
 * The attribution that stands in for the hidden reCAPTCHA badge: Google's wording with its policies linked where
 * tokens are sent, nothing where none are (no site key, an app shell).
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecaptchaNotice } from './recaptcha-notice';

const recaptcha = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/lib/recaptcha', () => ({ isRecaptchaEnabled: () => recaptcha.enabled }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  recaptcha.enabled = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('RecaptchaNotice', () => {
  it("states Google's attribution, with its policies linked, where tokens are sent", () => {
    act(() => root.render(<RecaptchaNotice />));

    expect(container.textContent).toBe(
      'This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.',
    );
    const links = [...container.querySelectorAll('a')].map(link => [link.textContent, link.getAttribute('href')]);
    expect(links).toEqual([
      ['Privacy Policy', 'https://policies.google.com/privacy'],
      ['Terms of Service', 'https://policies.google.com/terms'],
    ]);
  });

  it('says nothing where no token is sent', () => {
    recaptcha.enabled = false;
    act(() => root.render(<RecaptchaNotice />));

    expect(container.innerHTML).toBe('');
  });
});
