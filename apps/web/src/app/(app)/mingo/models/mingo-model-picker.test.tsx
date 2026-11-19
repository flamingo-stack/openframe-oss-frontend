import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoModelPicker } from './mingo-model-picker';
import type { MingoModelPickerState } from './use-mingo-model-selection';

let container: HTMLDivElement;
let root: Root;

function render(selection: Partial<MingoModelPickerState> = {}) {
  const choose = vi.fn();
  const chooseDefault = vi.fn();
  act(() =>
    root.render(
      <MingoModelPicker
        name="Claude Opus 4.8"
        provider="ANTHROPIC"
        selection={{
          disabled: false,
          followsDefault: false,
          chooseDefault,
          providers: [
            {
              provider: 'ANTHROPIC',
              current: true,
              models: [{ id: 'claude-opus', label: 'Claude Opus 4.8', current: true, choose: vi.fn() }],
            },
            {
              provider: 'OPENAI',
              current: false,
              models: Array.from({ length: 14 }, (_, index) => ({
                id: 'gpt-' + index,
                label: 'GPT ' + index,
                current: false,
                choose,
              })),
            },
          ],
          ...selection,
        }}
      />,
    ),
  );
  const button = container.querySelector('button');
  if (!button) throw new Error('Model picker button is missing');
  return { button, choose, chooseDefault };
}

function key(element: HTMLElement, value: string) {
  act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
}

function menuItem(role: string, label: string) {
  const item = [...document.querySelectorAll<HTMLElement>('[role="' + role + '"]')].find(
    element => element.textContent === label,
  );
  if (!item) throw new Error('Menu item is missing: ' + label);
  return item;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoModelPicker', () => {
  it('opens from the current model and allows a cross-provider choice', () => {
    const { button, choose } = render();
    expect(button.textContent).toBe('Claude Opus 4.8');

    key(button, 'Enter');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(menuItem('menuitem', 'Anthropic').getAttribute('aria-current')).toBe('true');

    const provider = menuItem('menuitem', 'OpenAI');
    key(provider, 'ArrowRight');
    const option = menuItem('menuitemradio', 'GPT 13');

    const list = option.parentElement;
    const footer = list?.nextElementSibling;
    expect(list?.classList.contains('overflow-y-auto')).toBe(true);
    expect(footer?.textContent).toContain('30 days');

    key(option, 'Enter');
    expect(choose).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('switches the open submenu when the pointer enters another provider', () => {
    const { button } = render();
    key(button, 'Enter');
    const anthropic = menuItem('menuitem', 'Anthropic');
    const openai = menuItem('menuitem', 'OpenAI');

    act(() => anthropic.dispatchEvent(new PointerEvent('pointerover', { pointerType: 'mouse', bubbles: true })));
    expect(anthropic.getAttribute('aria-expanded')).toBe('true');

    act(() =>
      anthropic.dispatchEvent(
        new PointerEvent('pointerout', { pointerType: 'mouse', bubbles: true, relatedTarget: openai }),
      ),
    );
    expect(openai.getAttribute('aria-expanded')).toBe('true');
    expect(anthropic.getAttribute('aria-expanded')).toBe('false');
    expect(menuItem('menuitemradio', 'GPT 13')).toBeTruthy();
  });

  it('can restore the default from the same menu', () => {
    const { button, chooseDefault } = render();
    key(button, 'Enter');
    key(menuItem('menuitemradio', 'Use Default Model'), 'Enter');
    expect(chooseDefault).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves the current model visible and disabled while changes are locked', () => {
    const { button } = render({ disabled: true });
    expect(button.textContent).toBe('Claude Opus 4.8');
    expect(button.disabled).toBe(true);
    key(button, 'Enter');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
