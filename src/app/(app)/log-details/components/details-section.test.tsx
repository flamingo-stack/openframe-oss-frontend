/**
 * Pins the shape of the payload part of the Log Details page: a script run
 * splits into an Input card and an Output card, anything else keeps the single
 * Details card, and each card's copy action puts its own pretty-printed JSON on
 * the clipboard. Each assertion was verified to fail with its guard removed.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asInstant } from '@/lib/graphql-scalars';
import type { LogEntry } from '../../logs-page/types/log.types';
import { DetailsSection } from './details-section';

const { toast, writeText } = vi.hoisted(() => ({ toast: vi.fn(), writeText: vi.fn(async () => undefined) }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

const BASE: LogEntry = {
  toolEventId: 'evt-1',
  eventType: 'SCRIPT_EXECUTED',
  ingestDay: '2026-10-01',
  toolType: 'RMM',
  severity: 'INFO',
  summary: 'Script executed',
  message: 'Script hello executed.',
  timestamp: asInstant('2026-10-01T10:46:31.534Z'),
  details: null,
};

const SCRIPT_RUN = {
  result: { output: 'hello\n', exit_code: 0, input: { name: 'hello', shell: 'BASH' } },
  additional_info: { timed_out: false },
};

let container: HTMLDivElement;
let root: Root;

function render(log: LogEntry) {
  act(() => {
    root.render(<DetailsSection logDetails={log} />);
  });
}

const titles = () => [...container.querySelectorAll('section')].map(s => s.getAttribute('aria-label'));

function button(name: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(element => element.textContent?.trim() === name);
  if (!match) throw new Error(`no button "${name}"`);
  return match;
}

describe('DetailsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows a script run as Input and Output cards', () => {
    render({ ...BASE, details: JSON.stringify(SCRIPT_RUN) });

    expect(titles()).toEqual(['Input', 'Output']);
    const [input, output] = container.querySelectorAll('pre');
    expect(input.textContent).toBe(JSON.stringify(SCRIPT_RUN.result.input, null, 2));
    expect(output.textContent).toBe(
      JSON.stringify({ result: { output: 'hello\n', exit_code: 0 }, additional_info: { timed_out: false } }, null, 2),
    );
  });

  it('keeps a single Details card for a log without an input', () => {
    render({ ...BASE, eventType: 'USER_LOGGED_IN', toolType: 'FLEET', details: '{"user":"ann"}' });

    expect(titles()).toEqual(['Details']);
    expect(container.querySelector('pre')?.textContent).toBe('{\n  "user": "ann"\n}');
  });

  it('colours keys and values but not the punctuation between them', () => {
    render({ ...BASE, details: '{"result":{"exit_code":1,"input":{"shell":"BASH"}}}' });

    const spans = [...container.querySelectorAll('pre span')].map(s => [s.textContent, s.className]);
    expect(spans).toEqual([
      ['shell', 'text-ods-error'],
      ['BASH', 'text-ods-success'],
      ['result', 'text-ods-error'],
      ['exit_code', 'text-ods-error'],
      ['1', 'text-ods-success'],
    ]);
  });

  it('copies each card as its own pretty-printed JSON', async () => {
    render({ ...BASE, details: JSON.stringify(SCRIPT_RUN) });

    await act(async () => {
      button('Copy Input').click();
    });
    expect(writeText).toHaveBeenLastCalledWith(JSON.stringify(SCRIPT_RUN.result.input, null, 2));
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ description: 'Input copied to clipboard' }));

    await act(async () => {
      button('Copy Output').click();
    });
    expect(writeText).toHaveBeenLastCalledWith(
      JSON.stringify({ result: { output: 'hello\n', exit_code: 0 }, additional_info: { timed_out: false } }, null, 2),
    );
  });
});
