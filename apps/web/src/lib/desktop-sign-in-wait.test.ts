import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { beginDesktopSignInWait, DESKTOP_LOGIN_TIMEOUT_MS, getDesktopSignInWait } from './desktop-sign-in-wait';

const wait = (loginUrl: string) => ({ loginUrl, deadline: 0 });

describe('beginDesktopSignInWait', () => {
  it('publishes the wait until it ends', () => {
    const end = beginDesktopSignInWait(wait('https://auth.example/1'));
    expect(getDesktopSignInWait()?.loginUrl).toBe('https://auth.example/1');

    end();
    expect(getDesktopSignInWait()).toBeNull();
  });

  // The shell supersedes the older sign-in, which then ends — after the newer one is already up.
  it('does not let a superseded wait take down the newer one', () => {
    const endFirst = beginDesktopSignInWait(wait('https://auth.example/1'));
    const endSecond = beginDesktopSignInWait(wait('https://auth.example/2'));

    endFirst();
    expect(getDesktopSignInWait()?.loginUrl).toBe('https://auth.example/2');
    endSecond();
    expect(getDesktopSignInWait()).toBeNull();
  });
});

describe('DESKTOP_LOGIN_TIMEOUT_MS', () => {
  // The countdown is only honest while it matches the window the shell actually enforces.
  it('is the shell’s LOGIN_TIMEOUT', () => {
    const shell = readFileSync(resolve(import.meta.dirname, '../../../desktop/src-tauri/src/lib.rs'), 'utf8');
    const seconds = shell.match(
      /const LOGIN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs\((\d+)\)/,
    )?.[1];

    expect(DESKTOP_LOGIN_TIMEOUT_MS).toBe(Number(seconds) * 1000);
  });
});
