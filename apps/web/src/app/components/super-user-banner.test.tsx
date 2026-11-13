/** The super user strip's room before `/me`: the strip's loading form, shown only under the before-paint mark. */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPER_USER_SEED_ATTRIBUTE } from '@/lib/super-user-seed';
import { SuperUserBannerSeed } from './super-user-banner';

// The placeholder reads nothing: the live strip's query is never run here.
vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: vi.fn() }));

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

describe('SuperUserBannerSeed', () => {
  it("draws the strip's box with its content invisible, hidden unless <html> carries the seed mark", () => {
    act(() => root.render(<SuperUserBannerSeed />));
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.className).toContain('hidden');
    // The variant reads the attribute the seed script sets.
    expect(wrapper?.className).toContain(`[html[${SUPER_USER_SEED_ATTRIBUTE}]_&]:contents`);
    // The strip's box keeps its fill and height; what is in it (the copy, the icon) is not seen.
    expect(wrapper?.className).toContain('[&>*>*]:invisible');
    expect(wrapper?.firstElementChild?.className).toContain('bg-ods-error-secondary');
  });
});
