'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { DIALOG_MODE } from '../constants';
import { ticketService } from '../services';
import type { Dialog } from '../types/dialog.types';
import { ticketsQueryKeys } from '../utils/query-keys';

interface UseDirectChatOptions {
  ticketId: string;
  dialogId: string | undefined;
  currentMode: string | undefined;
  onDialogCreated?: () => void;
}

export function useDirectChat({ ticketId, dialogId, currentMode, onDialogCreated }: UseDirectChatOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const setMode = useCallback(
    (mode: string, newDialogId?: string) => {
      queryClient.setQueryData<Dialog | null>(ticketsQueryKeys.detail(ticketId), prev =>
        prev ? { ...prev, currentMode: mode, ...(newDialogId ? { dialogId: newDialogId } : {}) } : prev,
      );
    },
    [queryClient, ticketId],
  );

  const isDirectMode = currentMode === DIALOG_MODE.DIRECT;

  const createDialogMutation = useMutation({
    mutationFn: () => ticketService.createDialog({ agentType: 'CLIENT', mode: DIALOG_MODE.DIRECT, ticketId }),
    onSuccess: newDialogId => {
      trackDashboardActivity(EVENT_SUBTYPE.START_DIRECT_CHAT);
      setMode(DIALOG_MODE.DIRECT, newDialogId);
      onDialogCreated?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Direct Chat Failed',
        description: error.message,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const switchModeMutation = useMutation({
    mutationFn: (targetDialogId: string) => ticketService.updateDialogMode(targetDialogId, DIALOG_MODE.DIRECT),
    onSuccess: () => {
      trackDashboardActivity(EVENT_SUBTYPE.START_DIRECT_CHAT);
      setMode(DIALOG_MODE.DIRECT);
    },
    onError: (error: Error) => {
      toast({
        title: 'Direct Chat Failed',
        description: error.message,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const startDirectChat = useCallback(() => {
    if (createDialogMutation.isPending || switchModeMutation.isPending) return;

    if (!dialogId) {
      createDialogMutation.mutate();
    } else {
      switchModeMutation.mutate(dialogId);
    }
  }, [dialogId, createDialogMutation, switchModeMutation]);

  return {
    isDirectMode,
    isStartingDirectChat: createDialogMutation.isPending || switchModeMutation.isPending,
    startDirectChat,
  };
}
