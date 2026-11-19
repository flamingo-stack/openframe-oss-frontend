import { ModelDisplay } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ActionsMenuDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mingoModelMenu } from './mingo-model-menu';
import type { DialogModelInput } from './mingo-model.types';

const CLAUDE = { provider: 'ANTHROPIC', modelName: 'claude-test', displayName: 'Claude Test' } as const;
const GPT = { provider: 'OPENAI', modelName: 'gpt-test', displayName: 'GPT Test' } as const;
const catalog = {
  ANTHROPIC: [{ value: CLAUDE.modelName, label: CLAUDE.displayName }],
  OPENAI: [{ value: GPT.modelName, label: GPT.displayName }],
  GOOGLE_GEMINI: [],
};
const select = vi.fn();
const retry = vi.fn();
let root: Root;
let container: HTMLDivElement;
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
const row = (name: string, role = 'menuitem') => {
  const element = [...document.querySelectorAll<HTMLElement>(`[role="${role}"]`)].find(
    candidate => candidate.textContent?.replace(/\s/g, '') === name.replace(/\s/g, ''),
  );
  if (!element) throw new Error(`Missing ${role}: ${name}`);
  return element;
};
async function key(element: HTMLElement, value: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
    await settle();
  });
}
async function clickWithMouse(element: HTMLElement, clientX = 895, clientY = 285) {
  await act(async () => {
    element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX, clientY }));
    const pointer = element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerType: 'mouse',
        clientX,
        clientY,
      }),
    );
    const mouse = element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    if (pointer && mouse) element.focus();
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
  });
}
function leftFlippedProviderLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement || this === document.body) return new DOMRect(0, 0, 1280, 900);
    const text = this.textContent?.replace(/\s/g, '');
    const role = this.getAttribute('role');
    if (role === 'menuitem' && text === 'ClaudeTestChatModel') return new DOMRect(768, 261, 254, 48);
    if (role === 'menuitem' && text === 'Anthropic') return new DOMRect(509, 311, 254, 48);
    if (role === 'menu') {
      const trigger = document.getElementById(this.getAttribute('aria-labelledby') ?? '');
      return trigger?.textContent?.replace(/\s/g, '') === 'ClaudeTestChatModel'
        ? new DOMRect(508, 261, 256, 197)
        : new DOMRect(768, 61, 256, 269);
    }
    return new DOMRect(1024, 0, 56, 56);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this === document.documentElement || this === document.body
      ? 1280
      : this.getAttribute('role') === 'menu' || this.hasAttribute('data-radix-popper-content-wrapper')
        ? 256
        : 254;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(48);
}
function Controls({ origin, unavailable = false }: { origin: 'label' | 'header' | 'composer'; unavailable?: boolean }) {
  const [selected, setSelected] = useState<DialogModelInput | null>(null);
  const [failed, setFailed] = useState(unavailable);
  const current = selected ? GPT : CLAUDE;
  const items = mingoModelMenu({
    currentModel: current,
    modelsByProvider: catalog,
    selected,
    disabled: failed,
    unavailable: failed,
    retry: () => {
      retry();
      setFailed(false);
    },
    select: async model => {
      select(model);
      setSelected(model);
    },
  });
  return origin === 'label' ? (
    <ModelDisplay modelName={current.modelName} displayName={current.displayName} modelMenuItems={items[0].submenu} />
  ) : (
    <ActionsMenuDropdown triggerAriaLabel={`${origin} actions`} groups={[{ items }]} />
  );
}
async function render(origin: 'label' | 'header' | 'composer', unavailable = false) {
  await act(async () => {
    root.render(<Controls origin={origin} unavailable={unavailable} />);
    await settle();
  });
  const button = container.querySelector<HTMLButtonElement>('button');
  if (!button) throw new Error('Missing model menu trigger');
  await key(button, 'ArrowDown');
  if (origin !== 'label') await key(row('Claude TestChat Model'), 'ArrowRight');
  return button;
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 48));
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(900);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(callback, 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  select.mockReset();
  retry.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Mingo menu through the real shared controls', () => {
  it.each(['label', 'header', 'composer'] as const)(
    'opens provider models from the %s origin after a direct mouse move into its left-flipped submenu',
    async origin => {
      leftFlippedProviderLayout();
      await act(async () => {
        root.render(<Controls origin={origin} />);
        await settle();
      });
      const trigger = container.querySelector<HTMLButtonElement>('button');
      if (!trigger) throw new Error('Missing model trigger');
      await clickWithMouse(trigger);
      let providerSide: string | null = null;
      if (origin !== 'label') {
        const model = row('Claude TestChat Model');
        await clickWithMouse(model);
        const provider = row('Anthropic');
        const providerMenu = provider.closest<HTMLElement>('[role="menu"]');
        await act(async () => {
          await settle();
        });
        providerSide = providerMenu?.getAttribute('data-side') ?? null;
        await act(async () => {
          model.dispatchEvent(
            new PointerEvent('pointerout', {
              bubbles: true,
              relatedTarget: provider,
              pointerType: 'mouse',
              clientX: 636,
              clientY: 335,
            }),
          );
          provider.dispatchEvent(
            new PointerEvent('pointerover', {
              bubbles: true,
              relatedTarget: model,
              pointerType: 'mouse',
              clientX: 636,
              clientY: 335,
            }),
          );
          await settle();
        });
      }
      expect(providerSide).toBe(origin === 'label' ? null : 'left');
      await clickWithMouse(row('Anthropic'), 636, 335);
      expect(row('Claude Test', 'menuitemradio')).toBeDefined();
      expect(select).not.toHaveBeenCalled();
    },
  );

  it.each(['label', 'header', 'composer'] as const)(
    'selects one exact provider/model from the %s origin',
    async origin => {
      const trigger = await render(origin);
      await key(row('OpenAI'), 'ArrowRight');
      const gpt = row('GPT Test', 'menuitemradio');
      expect(document.activeElement).toBe(gpt);
      await key(gpt, 'Enter');
      expect(select).toHaveBeenCalledExactlyOnceWith({ provider: 'OPENAI', modelName: 'gpt-test' });
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    },
  );

  it('retries a read failure from the existing model label, then exposes model choices', async () => {
    const trigger = await render('label', true);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    await key(row('Retry loading models'), 'Enter');
    expect(retry).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
    await key(trigger, 'ArrowDown');
    expect(row('Use Default Model', 'menuitemradio').getAttribute('aria-checked')).toBe('true');
    expect(row('OpenAI')).toBeDefined();
  });
});
