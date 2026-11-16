/** Mingo's home greeting: a bar of the heading's line until the viewer's hour and name are known. */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreetingText, useGreeting } from './mingo-home-greeting';

const auth = vi.hoisted(() => ({ user: null as { firstName?: string } | null }));

vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}));

function Greeting() {
  return (
    <h1>
      <GreetingText greeting={useGreeting()} />
    </h1>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 13, 21, 34));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  auth.user = null;
  vi.useRealTimers();
});

describe('the home greeting', () => {
  it('draws a bar of the heading line, no text, until the session user is known', () => {
    act(() => root.render(<Greeting />));
    expect(container.querySelector('h1')?.textContent).toBe('');
    expect(container.querySelector('h1 span')).not.toBeNull();
  });

  it("greets by the viewer's local hour and first name once known", () => {
    auth.user = { firstName: 'Michael' };
    act(() => root.render(<Greeting />));
    expect(container.querySelector('h1')?.textContent).toBe('Evening, Michael');
  });

  it('greets nobody in particular for a user without a first name', () => {
    auth.user = {};
    act(() => root.render(<Greeting />));
    expect(container.querySelector('h1')?.textContent).toBe('Good evening');
  });
});
