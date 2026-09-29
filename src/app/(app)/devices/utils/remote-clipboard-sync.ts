import type { MeshControlClient } from '@/lib/meshcentral/meshcentral-control';

/** Copy the operator's clipboard onto the device before a paste shortcut is sent. Best-effort: a denied read is ignored. */
export async function pushLocalClipboardToDevice(control: MeshControlClient | null, agentId: string | null | undefined): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text && control && agentId) {
      await control.setClipboard(agentId, text);
    }
  } catch {
    // Clipboard read failed (permissions/insecure context) — proceed anyway
  }
}

/** Copy the device's clipboard back to the operator after a copy shortcut settles. Best-effort: a denied write is ignored. */
export async function pullDeviceClipboardToLocal(control: MeshControlClient | null, agentId: string | null | undefined, settleMs = 250): Promise<void> {
  try {
    await new Promise(r => setTimeout(r, settleMs));
    if (control && agentId) {
      const text = await control.getClipboard(agentId);
      if (text) await navigator.clipboard.writeText(text);
    }
  } catch {
    // Clipboard write failed (permissions/insecure context) — ignore
  }
}
