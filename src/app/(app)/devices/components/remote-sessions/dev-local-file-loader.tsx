'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRef } from 'react';
import { getErrorMessage } from '@/lib/handle-api-error';

interface DevLocalFileLoaderProps {
  onLoad: (buffer: ArrayBuffer) => Promise<void>;
}

/**
 * Development-only affordance: open a local `.mcrec` sample straight into the
 * player, so the engine is testable end-to-end before the storage backend
 * (CU-86akc3c5q) exists. Renders nothing in production builds.
 */
export function DevLocalFileLoader({ onLoad }: DevLocalFileLoaderProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (process.env.NODE_ENV !== 'development') return null;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await onLoad(await file.arrayBuffer());
      toast({ title: 'Recording Loaded', description: file.name, variant: 'success', duration: 2000 });
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
        className="hidden"
        onChange={e => {
          const input = e.currentTarget;
          void handleFile(input.files?.[0]);
          input.value = '';
        }}
      />
      <Button variant="outline" size="small" onClick={() => inputRef.current?.click()}>
        Open local .mcrec (dev)
      </Button>
    </>
  );
}
