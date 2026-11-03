import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFaeFormMessage } from './use-fae-form-message';

const dialog = {
  id: 'd1',
  createdAt: '2026-11-02T10:00:00Z',
  title: 'Printer',
  description: 'It jams',
  creationSource: 'FAE_FORM',
};

let root: Root;
let seen: Array<ChatMessage | null>;

function Probe({ of, name }: { of: Parameters<typeof useFaeFormMessage>[0]; name: string }) {
  seen.push(useFaeFormMessage(of, name));
  return null;
}

const render = (of: Parameters<typeof useFaeFormMessage>[0], name = 'Fae') => {
  act(() => root.render(<Probe of={of} name={name} />));
  return seen[seen.length - 1];
};

describe('useFaeFormMessage', () => {
  beforeEach(() => {
    seen = [];
    root = createRoot(document.createElement('div'));
  });
  afterEach(() => {
    act(() => root.unmount());
  });

  it('is one object across renders of a new dialog object that says the same', () => {
    const first = render(dialog);
    expect(render({ ...dialog })).toBe(first);
  });

  it('is a new one when what it says changes', () => {
    const first = render(dialog);
    expect(render({ ...dialog, title: 'Scanner' })).not.toBe(first);
    expect(render({ ...dialog, title: 'Scanner' }, 'Mingo')?.metadata?.author?.name).toBe('Mingo');
  });

  it('says the subject and the description', () => {
    const message = render(dialog);
    const part = message?.parts[0];
    expect(part?.type === 'text' ? part.text : '').toContain('Subject:\nPrinter\n\nDescription:\nIt jams');
  });

  it('is nothing for a ticket that did not come from the form', () => {
    expect(render({ ...dialog, creationSource: 'ADMIN_DASHBOARD' })).toBeNull();
    expect(render(undefined)).toBeNull();
  });
});
