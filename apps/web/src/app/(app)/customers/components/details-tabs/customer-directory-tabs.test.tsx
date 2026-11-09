/**
 * Customer → Users and Customer → Groups read on their own. A failed read must cost the tab, drawn as its own error
 * with a retry under the tab's title, never reach the route boundary that replaces the whole customer page.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const views = vi.hoisted(() => ({ fail: true }));

function FailingView() {
  if (views.fail) throw new Error('directoryUsers failed');
  return <div>rows</div>;
}

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
}));
vi.mock('@/app/(app)/users/components/users-list/users-view', () => ({ UsersView: FailingView }));
vi.mock('@/app/(app)/users/components/groups-list/groups-view', () => ({ GroupsView: FailingView }));

import { CustomerGroupsTab } from './customer-groups-tab';
import { CustomerUsersTab } from './customer-users-tab';

let container: HTMLDivElement;
let root: Root;

describe('Customer → Users and Groups failures', () => {
  beforeEach(() => {
    views.fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it.each([
    ['Users', CustomerUsersTab, "Couldn't load the users."],
    ['Groups', CustomerGroupsTab, "Couldn't load the groups."],
  ])('keeps a failed %s read inside the tab, with a retry', (title, Tab, message) => {
    act(() => root.render(<Tab organizationId="org-1" />));
    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(message);

    views.fail = false;
    const retry = [...container.querySelectorAll('button')].find(button => /try again/i.test(button.textContent ?? ''));
    expect(retry).toBeDefined();
    act(() => retry?.click());
    expect(container.textContent).toContain('rows');
  });
});
