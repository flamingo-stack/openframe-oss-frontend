/**
 * Pins the "Customer Default" entry of the Edit Device permission select: a
 * device without an override opens on it, labelled with the mode it inherits;
 * a device with one opens on its own mode and asks the customer (or, with no
 * customer, the tenant) what "Customer Default" would resolve to; saving it
 * clears the override with `mode: null`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../types/device.types';
import type { DeviceRemoteAccessPolicy } from '../types/remote-access';
import { EditDisplayNameModal } from './edit-display-name-modal';

const { service, spies } = vi.hoisted(() => ({
  service: {
    getDevicePolicy: vi.fn(),
    getOrganizationPolicy: vi.fn(),
    getTenantPolicy: vi.fn(),
    setDeviceMode: vi.fn(),
  },
  spies: {
    toast: vi.fn<(options: Record<string, unknown>) => void>(),
    updateNickname: vi.fn<(deviceId: string, name: string) => Promise<boolean>>(),
  },
}));

vi.mock('../hooks/use-remote-access-approval-gate', () => ({ useRemoteAccessApprovalGate: () => 'on' }));

vi.mock('../hooks/use-device-actions', () => ({
  useDeviceActions: () => ({ updateNickname: spies.updateNickname, isSavingNickname: false }),
}));

// The real modules carry graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('../queries/devices-api', () => ({ DEVICES_PAGE_SIZE: 20 }));
vi.mock('../services/remote-access-policy-api-service', () => ({ remoteAccessPolicyApiService: service }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

// Radix Select opens on pointer events jsdom does not dispatch; a flat stand-in
// renders every item as a button that picks its value.
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => {
  const { createContext, useContext } = await import('react');
  const PickContext = createContext<(value: string) => void>(() => {});
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    Select: ({ onValueChange, children }: { onValueChange: (value: string) => void; children: ReactNode }) => (
      <PickContext.Provider value={onValueChange}>{children}</PickContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <div data-trigger="">{children}</div>,
    SelectValue: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: function SelectItem({ value, children }: { value: string; children: ReactNode }) {
      const pick = useContext(PickContext);
      return (
        <button type="button" data-option={value} onClick={() => pick(value)}>
          {children}
        </button>
      );
    },
  };
});

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const INHERITED: DeviceRemoteAccessPolicy = {
  mode: null,
  effectiveMode: 'NOTIFY_ONLY',
  effectiveScope: 'ORGANIZATION',
};

const OVERRIDDEN: DeviceRemoteAccessPolicy = {
  mode: 'DENY_ACCESS',
  effectiveMode: 'DENY_ACCESS',
  effectiveScope: 'DEVICE',
};

const device = (organizationId?: string) =>
  ({ id: 'node-1', machineId: 'machine-1', hostname: 'roman-pc', nickname: 'Roman PC', organizationId }) as Device;

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/** Mounts the modal closed, then opens it - the open transition is what seeds the name field. */
async function render(target: Device) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const show = (isOpen: boolean) =>
    root.render(
      <QueryClientProvider client={client}>
        <EditDisplayNameModal isOpen={isOpen} onClose={onClose} device={target} />
      </QueryClientProvider>,
    );
  act(() => show(false));
  act(() => show(true));
  await settle();
  await settle();
}

const trigger = () => document.querySelector('[data-trigger]')?.textContent;
const option = (value: string) => document.querySelector<HTMLButtonElement>(`[data-option="${value}"]`);
const saveButton = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('Save Device'));

async function click(element: HTMLElement | null | undefined) {
  if (!element) throw new Error('Nothing to click');
  act(() => element.click());
  await settle();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  service.getOrganizationPolicy.mockResolvedValue({ mode: null, effectiveMode: 'APPROVAL_REQUIRED' });
  service.getTenantPolicy.mockResolvedValue({ mode: 'SILENT_ACCESS' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('EditDisplayNameModal - Customer Default', () => {
  it('opens on Customer Default, labelled with the inherited mode, without reading the customer', async () => {
    service.getDevicePolicy.mockResolvedValue(INHERITED);
    await render(device('org-1'));

    expect(trigger()).toBe('Customer Default (Notify Only)');
    const items = Array.from(document.querySelectorAll('[data-option]')).map(el => el.getAttribute('data-option'));
    expect(items).toEqual(['CUSTOMER_DEFAULT', 'APPROVAL_REQUIRED', 'NOTIFY_ONLY', 'SILENT_ACCESS', 'DENY_ACCESS']);
    expect(option('CUSTOMER_DEFAULT')?.textContent).toContain("Follows the customer's setting");
    expect(service.getOrganizationPolicy).not.toHaveBeenCalled();
    expect(saveButton()?.disabled).toBe(true);
  });

  it('puts an overridden device back on Customer Default with mode null', async () => {
    service.getDevicePolicy.mockResolvedValue(OVERRIDDEN);
    service.setDeviceMode.mockResolvedValue({
      mode: null,
      effectiveMode: 'APPROVAL_REQUIRED',
      effectiveScope: 'ORGANIZATION',
    });
    await render(device('org-1'));

    expect(trigger()).toBe('Deny Access');
    expect(service.getOrganizationPolicy).toHaveBeenCalledWith('org-1');
    expect(option('CUSTOMER_DEFAULT')?.textContent).toContain('Customer Default (Approval Required)');

    await click(option('CUSTOMER_DEFAULT'));
    expect(trigger()).toBe('Customer Default (Approval Required)');
    await click(saveButton());

    expect(service.setDeviceMode).toHaveBeenCalledWith('machine-1', null);
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('labels Customer Default with the tenant default for a device without a customer', async () => {
    service.getDevicePolicy.mockResolvedValue(OVERRIDDEN);
    await render(device());

    expect(option('CUSTOMER_DEFAULT')?.textContent).toContain('Customer Default (Silent Access)');
    expect(service.getOrganizationPolicy).not.toHaveBeenCalled();
  });

  it('still saves a picked mode as the device override', async () => {
    service.getDevicePolicy.mockResolvedValue(INHERITED);
    service.setDeviceMode.mockResolvedValue(OVERRIDDEN);
    await render(device('org-1'));

    await click(option('DENY_ACCESS'));
    await click(saveButton());

    expect(service.setDeviceMode).toHaveBeenCalledWith('machine-1', 'DENY_ACCESS');
  });
});
