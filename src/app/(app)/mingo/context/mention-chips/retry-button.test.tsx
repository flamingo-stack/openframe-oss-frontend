import { ChatMessageEnhanced } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withRetryAction } from '../../utils/retry-turn';
import { renderMingoMention } from './render-mention';
import { MingoRetryContext } from './retry-button';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// The entity chips fetch through Relay and REST; none of them render here.
vi.mock('./relay-mention-chips', () => ({ GraphqlMentionChip: () => null }));
vi.mock('./rest-mention-chips', () => ({ RestMentionChip: () => null }));

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const failedTurn = withRetryAction({
  id: 'assistant-1',
  role: 'assistant',
  content: '',
  segments: [
    { type: 'text', text: 'Checking the policy' },
    { type: 'error', title: 'AI response error', details: 'request timed out' },
  ],
});

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

function renderBubble(retry: (() => void) | null) {
  act(() => {
    root.render(
      <MingoRetryContext value={retry}>
        <ChatMessageEnhanced role="assistant" content={failedTurn.segments ?? []} renderMention={renderMingoMention} />
      </MingoRetryContext>,
    );
  });
}

describe('Retry under a failed Mingo turn', () => {
  it('renders a Retry button after the error banner and keeps the partial reply', () => {
    const retry = vi.fn();
    renderBubble(retry);

    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Retry');
    expect(container.textContent).toContain('Checking the policy');
    expect(container.textContent).toContain('AI response error');
    expect(container.textContent).not.toContain('@retry:turn');

    act(() => button?.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for the token when there is no turn to retry', () => {
    renderBubble(null);

    expect([...container.querySelectorAll('button')].some(b => b.textContent === 'Retry')).toBe(false);
  });
});
