/**
 * The Manage AI Balance modal's form, case by case (CU-17tkuw5tdcv): what the
 * box and the button do against what is saved, the arrangement's three figures
 * and their rules, the spend over the last 30 days, and the pause.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoTopUpStatus } from './auto-top-up-status';
import { ManageAiBalanceForm, type ManageAiBalanceFormData } from './manage-ai-balance-form';

const spies = vi.hoisted(() => ({
  update: vi.fn(),
  purchase: vi.fn(),
  toast: vi.fn(),
  onClose: vi.fn(),
}));

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({ graphql: () => ({}), readInlineData: () => ({}) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));
vi.mock('./use-update-auto-top-up', () => ({
  useUpdateAutoTopUp: () => ({ mutate: spies.update, isPending: false }),
}));
vi.mock('./use-purchase-tokens', () => ({
  usePurchaseTokens: () => ({ mutate: spies.purchase, isPending: false }),
}));

/** $ per token: $50 buys 5M, as the mockup says. */
const TOKEN_PRICE = 0.00001;

function status(overrides: Partial<AutoTopUpStatus> = {}): AutoTopUpStatus {
  return {
    enabled: true,
    amountUsd: 50,
    thresholdUsd: 10,
    spendLimitUsd: 200,
    spentUsd: 100,
    paused: false,
    resumesAt: null,
    minimumAmountUsd: 10,
    minimumThresholdUsd: 2,
    switchedOff: null,
    paymentMethodSetupUrl: null,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function render(data: ManageAiBalanceFormData | null) {
  act(() => root.render(<ManageAiBalanceForm data={data} onClose={spies.onClose} />));
}

const renderWith = (overrides: Partial<AutoTopUpStatus> = {}, tokenPrice: number | null = TOKEN_PRICE) =>
  render({ settings: status(overrides), tokenPrice });

/** The element, or a failure that names what was missing. */
function found<T>(el: T | null | undefined, what: string): T {
  if (el == null) throw new Error(`Not rendered: ${what}`);
  return el;
}

const text = () => container.textContent ?? '';
const checkbox = () => found(container.querySelector<HTMLButtonElement>('[role="checkbox"]'), 'checkbox');
const inputs = () => [...container.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')];
const field = (label: string) =>
  found(container.querySelector<HTMLInputElement>(`input[aria-label="${label}, USD"]`), label);
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>('button')];
const button = (name: string) =>
  found(
    buttons().find(b => b.textContent?.trim() === name),
    name,
  );
const buttonStarting = (prefix: string) =>
  found(
    buttons().find(b => b.textContent?.startsWith(prefix)),
    prefix,
  );
const notes = () => [...container.querySelectorAll('p.min-h-5')].map(p => p.textContent);
const progress = () => container.querySelector('[role="progressbar"]');

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const click = (el: HTMLElement) => act(() => el.click());

/** The last `updateAutoTopUp` call: its input, and the callback that answers it. */
function lastUpdate() {
  const [input, options] = found(spies.update.mock.calls.at(-1), 'an updateAutoTopUp call');
  return { input, onCompleted: options.onCompleted as (s: AutoTopUpStatus) => void };
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('auto top-up off: a one-time purchase', () => {
  it('offers the amount tiles and buys the chosen one once', () => {
    renderWith({ enabled: false });
    expect(checkbox().getAttribute('aria-checked')).toBe('false');
    expect(text()).toContain('One-Time Top Up');
    expect(inputs()).toHaveLength(0);

    click(button('Proceed to Payment'));
    expect(spies.purchase).not.toHaveBeenCalled();
    expect(text()).toContain('Choose a top-up amount.');

    click(buttonStarting('$50'));
    click(button('Proceed to Payment'));
    expect(spies.purchase).toHaveBeenCalledWith(50, { onSuccess: spies.onClose });
    expect(spies.update).not.toHaveBeenCalled();
  });

  it('holds a custom amount to the floor the backend states', () => {
    renderWith({ enabled: false, minimumAmountUsd: 25 });
    click(buttonStarting('Custom'));
    type(found(container.querySelector<HTMLInputElement>('input'), 'custom amount'), '20');
    click(button('Proceed to Payment'));
    expect(text()).toContain('The minimum top-up is $25.');
    expect(spies.purchase).not.toHaveBeenCalled();
  });
});

describe('turning auto top-up on', () => {
  it('asks the three figures, starting from the ones kept while it was off', () => {
    renderWith({ enabled: false, thresholdUsd: 10, amountUsd: 20, spendLimitUsd: 100 });
    click(checkbox());

    expect(text()).toContain('Automatically refill your balance when it drops below the threshold.');
    expect(text()).toContain('Auto Top-up Settings');
    expect(text()).not.toContain('One-Time Top Up');
    expect(inputs().map(i => i.value)).toEqual(['10', '20', '100']);
    expect(button('Save')).toBeTruthy();
  });

  it('starts empty when nothing was ever saved', () => {
    renderWith({ enabled: false, thresholdUsd: null, amountUsd: null, spendLimitUsd: null, spentUsd: 0 });
    click(checkbox());
    expect(inputs().map(i => i.value)).toEqual(['', '', '']);
    expect(field('Spend Limit').placeholder).toBe('No limit');
  });

  it('saves all three figures, and says what it saved', () => {
    renderWith({ enabled: false, thresholdUsd: 10, amountUsd: 20, spendLimitUsd: 100 });
    click(checkbox());
    type(field('Top-up Amount'), '50');
    type(field('Spend Limit'), '300');
    click(button('Save'));

    const { input, onCompleted } = lastUpdate();
    expect(input).toEqual({ enabled: true, thresholdUsd: 10, amountUsd: 50, spendLimitUsd: 300 });
    act(() => onCompleted(status({ amountUsd: 50, spendLimitUsd: 300 })));
    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Auto Top-up Saved',
        description: 'Your balance refills with $50 whenever it drops below $10.',
        variant: 'success',
      }),
    );
    expect(spies.onClose).toHaveBeenCalled();
  });

  it('sends an empty limit as no limit', () => {
    renderWith();
    type(field('Spend Limit'), '');
    click(button('Save'));
    expect(lastUpdate().input).toEqual({ enabled: true, thresholdUsd: 10, amountUsd: 50, spendLimitUsd: null });
  });

  it('keeps the modal open and asks for a card when the save needs one', () => {
    renderWith({ enabled: false });
    click(checkbox());
    click(button('Save'));
    act(() => lastUpdate().onCompleted(status({ enabled: false, paymentMethodSetupUrl: 'https://stripe.test/setup' })));
    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Add a Payment Method', variant: 'warning' }),
    );
    expect(spies.onClose).not.toHaveBeenCalled();
  });

  it('shows where to add the card once the answer says so', () => {
    renderWith({ enabled: false, paymentMethodSetupUrl: 'https://stripe.test/setup' });
    expect(text()).not.toContain('A card on file is needed first.');
    click(checkbox());
    expect(text()).toContain('A card on file is needed first.');
  });
});

describe('the rules of the figures', () => {
  it('stays quiet until a save is tried, then answers every edit', () => {
    renderWith();
    type(field('Threshold'), '60');
    expect(notes()).toContain('Balance that triggers a refill');

    click(button('Save'));
    expect(spies.update).not.toHaveBeenCalled();
    expect(notes()).toContain('The threshold must be lower than the top-up amount.');
    expect(field('Threshold').getAttribute('aria-invalid')).toBe('true');

    type(field('Threshold'), '20');
    expect(notes()).toContain('Balance that triggers a refill');
  });

  it('refuses a threshold equal to the amount', () => {
    renderWith();
    type(field('Threshold'), '50');
    click(button('Save'));
    expect(notes()).toContain('The threshold must be lower than the top-up amount.');
    expect(spies.update).not.toHaveBeenCalled();
  });

  it('refuses a limit under one top-up, and takes one equal to it', () => {
    renderWith();
    type(field('Spend Limit'), '49');
    click(button('Save'));
    expect(notes()).toContain('The spend limit must be at least the top-up amount.');
    expect(spies.update).not.toHaveBeenCalled();

    type(field('Spend Limit'), '50');
    click(button('Save'));
    expect(lastUpdate().input.spendLimitUsd).toBe(50);
  });

  it('holds the amount and the threshold to the floors the backend states', () => {
    renderWith({ minimumAmountUsd: 25, minimumThresholdUsd: 5 });
    type(field('Threshold'), '4');
    type(field('Top-up Amount'), '24');
    click(button('Save'));
    expect(notes()).toEqual(expect.arrayContaining(['The minimum threshold is $5.', 'The minimum top-up is $25.']));
    expect(spies.update).not.toHaveBeenCalled();
  });

  it('asks for the figures it cannot do without', () => {
    renderWith();
    type(field('Threshold'), '');
    type(field('Top-up Amount'), '');
    click(button('Save'));
    expect(notes()).toEqual(expect.arrayContaining(['Enter a threshold.', 'Enter a top-up amount.']));
    expect(spies.update).not.toHaveBeenCalled();
  });

  it('keeps whole dollars of what is typed or pasted', () => {
    renderWith();
    type(field('Top-up Amount'), '$75.99');
    expect(field('Top-up Amount').value).toBe('75');
    type(field('Spend Limit'), '1,000');
    expect(field('Spend Limit').value).toBe('1000');
  });

  it('states what one top-up buys at the catalog rate, and nothing without one', () => {
    renderWith();
    expect(notes()).toContain('≈ 5M tokens per top-up');
    type(field('Top-up Amount'), '100');
    expect(notes()).toContain('≈ 10M tokens per top-up');

    act(() => root.unmount());
    root = createRoot(container);
    renderWith({}, null);
    expect(text()).not.toContain('tokens per top-up');
  });
});

describe('the spend over the last 30 days', () => {
  it('fills the bar toward the limit', () => {
    renderWith({ spentUsd: 100, spendLimitUsd: 200 });
    expect(text()).toContain('Spent on auto top-ups in the last 30 days');
    expect(text()).toContain('$100.00 of $200.00');
    expect(progress()?.getAttribute('aria-valuenow')).toBe('50');
  });

  it('measures the limit as typed, before the save', () => {
    renderWith({ spentUsd: 100, spendLimitUsd: 200 });
    type(field('Spend Limit'), '400');
    expect(text()).toContain('$100.00 of $400.00');
    expect(progress()?.getAttribute('aria-valuenow')).toBe('25');
  });

  it('states the spend without a bar when there is no limit', () => {
    renderWith({ spentUsd: 40, spendLimitUsd: null });
    expect(text()).toContain('$40.00');
    expect(text()).not.toContain(' of $');
    expect(progress()).toBeNull();
  });

  it('turns the bar to the error tone at the limit', () => {
    renderWith({ spentUsd: 200, spendLimitUsd: 200 });
    expect(progress()?.getAttribute('aria-valuenow')).toBe('100');
    expect(progress()?.querySelector('.bg-ods-error')).not.toBeNull();
  });
});

describe('the limit holds refills back', () => {
  it('says so over the figures, with when the next refill is tried', () => {
    renderWith({ paused: true, spentUsd: 200, resumesAt: '2026-11-04T10:00:00Z' as AutoTopUpStatus['resumesAt'] });
    expect(text()).toContain('Spend limit reached');
    expect(text()).toContain('Auto top-ups are paused until');
    expect(text()).toContain('Raise the limit to resume them sooner.');
  });

  it('lifts with a save that raises the limit', () => {
    renderWith({ paused: true, spentUsd: 200 });
    type(field('Spend Limit'), '400');
    click(button('Save'));
    expect(lastUpdate().input).toEqual({ enabled: true, thresholdUsd: 10, amountUsd: 50, spendLimitUsd: 400 });
  });

  it('is not said while the box is unticked', () => {
    renderWith({ paused: true });
    click(checkbox());
    expect(text()).not.toContain('Spend limit reached');
  });
});

describe('turning auto top-up off', () => {
  it('switches it off and sends the limit back, so it is kept', () => {
    renderWith();
    click(checkbox());
    expect(inputs()).toHaveLength(0);
    expect(text()).not.toContain('One-Time Top Up');
    click(button('Turn Off Auto Top-up'));

    const { input, onCompleted } = lastUpdate();
    expect(input).toEqual({ enabled: false, spendLimitUsd: 200 });
    act(() => onCompleted(status({ enabled: false })));
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Auto Top-up Off', variant: 'success' }));
    expect(spies.onClose).toHaveBeenCalled();
  });

  it('ticking it back restores the figures as they were', () => {
    renderWith();
    type(field('Top-up Amount'), '70');
    click(checkbox());
    click(checkbox());
    expect(field('Top-up Amount').value).toBe('70');
  });
});

describe('after the system switched it off', () => {
  it.each([
    ['PAYMENT_FAILED', 'Switched off after a declined charge.'],
    ['AUTHENTICATION_ABANDONED', 'Switched off after an unconfirmed charge.'],
    ['NO_PAYMENT_METHOD', 'Switched off: no card on file can be charged automatically.'],
  ] as const)('says why the box is unticked: %s', (reason, why) => {
    renderWith({ enabled: false, switchedOff: reason });
    expect(text()).toContain(why);
    click(checkbox());
    expect(text()).not.toContain(why);
  });
});

describe('while the arrangement is on its way', () => {
  it('draws the controls locked', () => {
    render(null);
    expect(checkbox().disabled).toBe(true);
    expect(button('Proceed to Payment').disabled).toBe(true);
  });
});
