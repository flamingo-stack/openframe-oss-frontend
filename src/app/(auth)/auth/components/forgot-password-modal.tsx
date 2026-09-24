'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { authApiClient } from '@/lib/auth-api-client';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function ForgotPasswordModal({ open, onOpenChange, defaultEmail = '' }: ForgotPasswordModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApiClient.requestPasswordReset({ email: email.trim() });

      if (response.ok) {
        toast({
          title: 'Reset Link Sent',
          description: `A password reset link has been sent to ${email.trim()}. Please check your inbox.`,
          variant: 'success',
          duration: 5000,
        });
        onOpenChange(false);
        setEmail('');
      } else {
        throw new Error(response.error || 'Failed to send reset link');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Unable to send password reset link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setEmail(defaultEmail);
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md border border-ods-border bg-ods-card p-8">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-ods-text-primary text-h2">Reset Your Password</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-ods-text-secondary text-h6">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-6">
          <Label htmlFor="reset-email" className="text-ods-text-primary">
            Email Address
          </Label>
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="username@mail.com"
            disabled={isSubmitting}
            className="mt-2 border-ods-border bg-ods-card p-3 text-ods-text-primary text-h6 placeholder:text-ods-text-secondary"
            onKeyDown={e => {
              if (e.key === 'Enter' && !isSubmitting) {
                handleSubmit();
              }
            }}
          />
        </div>

        <AlertDialogFooter className="mt-6 gap-4">
          <Button
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            variant="outline"
            className="flex-1 rounded-[6px] border border-ods-border bg-ods-card px-4 py-2.5 font-bold text-ods-text-primary text-h6 hover:bg-ods-bg-hover"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!email.trim() || isSubmitting}
            loading={isSubmitting}
            className="flex-1 rounded-[6px] bg-ods-accent px-4 py-2.5 font-bold text-ods-text-on-accent text-h6 hover:opacity-90"
          >
            Send Reset Link
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
