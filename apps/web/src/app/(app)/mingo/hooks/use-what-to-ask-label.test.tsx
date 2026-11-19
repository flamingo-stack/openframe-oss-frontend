/**
 * "What to ask?" as this app's screens read it: the hub's `/what-can-you-do` command from the chat's command catalog.
 * No command, no entry; the label is the command's own; and while the catalog is read the answer is "not known yet"
 * (`pending`), which is what lets a screen hold the entry's place instead of moving when it lands.
 */
import type { SlashCommandSummary } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhatToAsk, useWhatToAskLabel, type WhatToAskEntry } from './use-what-to-ask-label';

const catalog = vi.hoisted(() => ({
  commandsUrl: 'https://hub.example/content/api/commands' as string | undefined,
  commands: [] as { id: string; label?: string }[],
  loading: false,
  /** What the registry was asked for, per call. */
  asked: [] as { url: string; enabled: boolean | undefined }[],
}));

// The lib's catalog hooks, answered here: the registry is one cached request both of them read. `whatToAskLabelOf`
// is the lib's own.
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<object>()),
  useSlashCommandRegistry: (url: string, options?: { enabled?: boolean }) => {
    catalog.asked.push({ url, enabled: options?.enabled });
    return { commands: catalog.commands, loading: catalog.loading, loaded: !catalog.loading };
  },
  useWhatToAskCommand: (url: string | undefined) =>
    (url ? (catalog.commands.find(command => command.id === 'what-can-you-do') as SlashCommandSummary) : null) ?? null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/contexts', () => ({
  useChatRuntime: () => (catalog.commandsUrl ? { endpoints: { commandsUrl: catalog.commandsUrl } } : null),
}));

let container: HTMLDivElement;
let root: Root;
/** What both hooks answer, printed: a render must not write to anything outside itself. */
function Probe() {
  const seen: { entry: WhatToAskEntry; label: string | null } = { entry: useWhatToAsk(), label: useWhatToAskLabel() };
  return <output>{JSON.stringify(seen)}</output>;
}
const read = (): { entry: WhatToAskEntry; label: string | null } => {
  act(() => root.render(<Probe />));
  return JSON.parse(container.textContent ?? '{}');
};

beforeEach(() => {
  catalog.commandsUrl = 'https://hub.example/content/api/commands';
  catalog.commands = [];
  catalog.loading = false;
  catalog.asked = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useWhatToAsk', () => {
  it("is the hub's command under the label the hub gives it", () => {
    catalog.commands = [
      { id: 'help', label: 'Help' },
      { id: 'what-can-you-do', label: 'What can you do?' },
    ];
    expect(read()).toEqual({ entry: { label: 'What can you do?', pending: false }, label: 'What can you do?' });
  });

  it('falls back to the command itself when the hub gives it no label', () => {
    catalog.commands = [{ id: 'what-can-you-do' }];
    expect(read().entry.label).toBe('/what-can-you-do');
  });

  it('is no entry when the catalog has answered and lists no such command', () => {
    catalog.commands = [{ id: 'help', label: 'Help' }];
    expect(read()).toEqual({ entry: { label: null, pending: false }, label: null });
  });

  it('is not known yet while the catalog is read', () => {
    catalog.loading = true;
    expect(read().entry).toEqual({ label: null, pending: true });
  });

  it("reads the chat's own catalog address, and asks for nothing without a chat runtime", () => {
    read();
    expect(catalog.asked.at(-1)).toEqual({ url: 'https://hub.example/content/api/commands', enabled: true });

    catalog.commandsUrl = undefined;
    expect(read().entry).toEqual({ label: null, pending: false });
    expect(catalog.asked.at(-1)).toEqual({ url: '', enabled: false });
  });
});
