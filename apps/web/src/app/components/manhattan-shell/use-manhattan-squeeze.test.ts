/**
 * The v2 shell's window form: only the tablet band is compact; a narrower desktop window
 * folds no sidebar.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import openframeCorePreset from '@flamingo-stack/openframe-frontend-core/tailwind.config.ts';
import postcss, { type AtRule, type Rule } from 'postcss';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import {
  COMPACT_BAND_FLEX,
  COMPACT_BAND_HIDDEN,
  MANHATTAN_COMPACT_BELOW,
  squeezeOf,
  useManhattanSqueeze,
} from './use-manhattan-squeeze';

describe('squeezeOf', () => {
  it('is compact from md up to two rails + 800px, and leaves the phone to its own shell', () => {
    expect(squeezeOf({ windowWidth: 860 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 800 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 912 }).compact).toBe(false);
    expect(squeezeOf({ windowWidth: 700 }).compact).toBe(false);
  });

  it('folds nothing on a narrow desktop: the sidebars stay as the user left them', () => {
    for (const windowWidth of [1000, 1100, 1280, 1440]) {
      expect(squeezeOf({ windowWidth })).toEqual({ compact: false, measured: true });
    }
  });
});

describe('useManhattanSqueeze', () => {
  it('re-renders on a resize only when the window crosses a step, not on every pixel', () => {
    const resize = (width: number) =>
      act(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
        window.dispatchEvent(new Event('resize'));
      });
    resize(1000);
    let renders = 0;
    let compact: boolean | null = null;
    function Probe() {
      renders += 1;
      compact = useManhattanSqueeze(true).compact;
      return null;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(createElement(Probe)));
    const settled = renders;
    expect(compact).toBe(false);

    resize(1100);
    resize(1280);
    expect(renders).toBe(settled);

    resize(860);
    expect(compact).toBe(true);
    expect(renders).toBe(settled + 1);
    act(() => root.unmount());
  });
});

describe('before the window is read', () => {
  it('is not measured in the server markup, so the stylesheet draws the compact band', () => {
    function Probe() {
      const { compact, measured } = useManhattanSqueeze(true);
      return `${compact}/${measured}`;
    }
    expect(renderToString(createElement(Probe))).toBe('false/false');
  });

  it('is measured with an OSS tenant (never compact): no band to draw', () => {
    function Probe() {
      const { compact, measured } = useManhattanSqueeze(false);
      return `${compact}/${measured}`;
    }
    expect(renderToString(createElement(Probe))).toBe('false/true');
  });
});

/** The media queries around `selector`'s rule, outermost first, and the rule's place in the sheet. */
function ruleOf(css: string, selector: string): { media: string[]; index: number } {
  let found: { media: string[]; index: number } | null = null;
  let index = 0;
  postcss.parse(css).walkRules((rule: Rule) => {
    index += 1;
    if (rule.selector !== selector) return;
    const media: string[] = [];
    for (let parent = rule.parent; parent && parent.type === 'atrule'; parent = parent.parent) {
      media.unshift((parent as AtRule).params);
    }
    found = { media, index };
  });
  if (!found) throw new Error(`no rule for ${selector}`);
  return found;
}

describe('the compact band in the stylesheet (COMPACT_BAND_HIDDEN / COMPACT_BAND_FLEX)', () => {
  it("is md up to the step the hook reads, and wins over the sidebar's md:flex", async () => {
    // The widest compact window: `max-[…]` is inclusive (`max-width`).
    const widest = `${MANHATTAN_COMPACT_BELOW - 1}px`;
    expect(COMPACT_BAND_HIDDEN).toBe(`md:max-[${widest}]:hidden`);
    expect(COMPACT_BAND_FLEX).toBe(`md:max-[${widest}]:flex`);

    // The app's own Tailwind preset over the classes the sidebars and the bar carry.
    const { css } = await postcss([
      tailwindcss({
        presets: [openframeCorePreset],
        content: [{ raw: `hidden md:flex ${COMPACT_BAND_HIDDEN} ${COMPACT_BAND_FLEX}`, extension: 'html' }],
        corePlugins: { preflight: false },
      }),
    ]).process('@tailwind utilities;', { from: undefined });

    const escape = (cls: string) => `.${cls.replace(/[:[\]]/g, m => `\\${m}`)}`;
    const hidden = ruleOf(css, escape(COMPACT_BAND_HIDDEN));
    const flex = ruleOf(css, escape(COMPACT_BAND_FLEX));
    // From md (the hook's tablet step, 800px) up to the widest compact window: `squeezeOf`'s band.
    for (const rule of [hidden, flex]) {
      expect(rule.media).toEqual(['(min-width: 800px)', `(max-width: ${widest})`]);
    }
    expect(squeezeOf({ windowWidth: 800 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: MANHATTAN_COMPACT_BELOW - 1 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: MANHATTAN_COMPACT_BELOW }).compact).toBe(false);
    // Later in the sheet than the sidebar's `md:flex` and the bar's `hidden`, at the same specificity.
    expect(hidden.index).toBeGreaterThan(ruleOf(css, escape('md:flex')).index);
    expect(flex.index).toBeGreaterThan(ruleOf(css, escape('hidden')).index);
  });
});

describe('the first paint below the compact step (globals.css)', () => {
  it('hides the split from the first paint at the same step the centre leaves it in JS', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../../globals.css'), 'utf8');
    const rule = new RegExp(
      `@media not all and \\(min-width: ${MANHATTAN_COMPACT_BELOW}px\\) \\{\\s*\\[data-work-area='split'\\] > \\[data-work-area-column='chat'\\]`,
    );
    expect(css).toMatch(rule);
  });
});
