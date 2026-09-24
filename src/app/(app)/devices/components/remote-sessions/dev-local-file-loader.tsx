'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRef } from 'react';
import { getErrorMessage } from '@/lib/handle-api-error';
import { useRemoteAccessMockTools } from '../../hooks/use-remote-access-mock-tools';

interface DevLocalFileLoaderProps {
  /** The selected `.mcrec` files, one session's segments, in any order. */
  onLoad: (buffers: ArrayBuffer[]) => Promise<void>;
}

/**
 * Mock-tooling affordance: open a local `.mcrec` sample straight into the
 * player, so the engine is testable end-to-end before the storage backend
 * (CU-86akc3c5q) exists. Visibility is decided by the caller (the temporary
 * `remote-access-mock-tools` flag plus `?dev=1`), not by the build type, so
 * QA can use it on a production build.
 */
export function DevLocalFileLoader({ onLoad }: DevLocalFileLoaderProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Defense in depth: the caller gates on the same flag, but the component
  // refuses to render without it so a missed caller-side check cannot expose
  // the loader.
  const mockToolsEnabled = useRemoteAccessMockTools();

  if (!mockToolsEnabled) return null;

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      await onLoad(await Promise.all(files.map(file => file.arrayBuffer())));
      const description = files.length === 1 ? files[0].name : `${files.length} segments stitched`;
      toast({ title: 'Recording Loaded', description, variant: 'success', duration: 2000 });
    } catch (error) {
      toast({ title: 'Failed to load recording', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".mcrec"
        multiple
        className="hidden"
        onChange={e => {
          const input = e.currentTarget;
          void handleFiles(Array.from(input.files ?? []));
          input.value = '';
        }}
      />
      <Button variant="outline" size="small" onClick={() => inputRef.current?.click()}>
        Open local .mcrec segments (mock)
      </Button>
    </>
  );
}
