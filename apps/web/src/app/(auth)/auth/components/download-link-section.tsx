'use client';
'use no memo';

import { EmailCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, HoneypotField, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { getPlatformUrl } from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { HUBSPOT_DO_NOT_COLLECT_FORM_PROPS } from '@flamingo-stack/openframe-frontend-core/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authApiClient } from '@/lib/auth-api-client';

/**
 * Every word the page says. The form's are the marketing site's "Send me download link" dialog's,
 * which this page took over from, so a visitor reads the same thing they did there.
 */
export const DOWNLOAD_LINK_COPY = {
  title: 'Get it on your computer',
  intro: "OpenFrame runs on your Mac or Windows computer. We'll send one email with the download link.",
  emailLabel: 'Work email',
  emailPlaceholder: 'you@company.com',
  invalidEmail: 'Enter a valid email address',
  submit: 'Send the link',
  consent: 'One email with the link. No newsletter, no list.',
  sentTitle: 'Check your inbox',
  sentBody: 'Open the email on your Mac or Windows computer to install.',
  back: 'Back to OpenFrame',
  failedTitle: 'Could not send the link',
  failedBody: 'Please try again in a moment.',
} as const;

/** The honeypot's field name, which is also the request's: the backend drops a request that fills it. */
const HONEYPOT_NAME = 'website';

const downloadLinkSchema = z.object({
  email: z.string().trim().pipe(z.email(DOWNLOAD_LINK_COPY.invalidEmail)),
});

type DownloadLinkValues = z.infer<typeof downloadLinkSchema>;

/**
 * "Send me download link": one email field, posted to the backend, which emails the installer
 * links with a download id recorded against this visit's attribution. "Sent" follows any success:
 * the backend answers the same whatever it decided about the address, so nothing here can tell a
 * filtered request from a delivered one. A failed request keeps the form and says so.
 */
export function DownloadLinkSection() {
  const { toast } = useToast();
  const honeypotRef = useRef<HTMLInputElement>(null);
  const form = useForm<DownloadLinkValues>({
    resolver: zodResolver(downloadLinkSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const request = useMutation({
    mutationFn: async ({ email }: DownloadLinkValues) => {
      const response = await authApiClient.requestDownloadLink({
        email,
        website: honeypotRef.current?.value ?? '',
      });
      if (!response.ok) throw new Error(response.error);
    },
    onError: () => {
      toast({
        title: DOWNLOAD_LINK_COPY.failedTitle,
        description: DOWNLOAD_LINK_COPY.failedBody,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = form.handleSubmit(values => request.mutate(values));
  const emailError = form.formState.errors.email?.message;

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
      {request.isSuccess ? (
        <>
          <div className="flex flex-col">
            <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">{DOWNLOAD_LINK_COPY.sentTitle}</h1>
            <div className="flex items-start gap-[var(--spacing-system-sf)]">
              <EmailCheckIcon aria-hidden className="h-6 w-6 shrink-0 text-ods-success" />
              <p className="text-ods-text-secondary text-h4">{DOWNLOAD_LINK_COPY.sentBody}</p>
            </div>
          </div>
          <Button variant="outline" fullWidth href={getPlatformUrl('openframe', { environment: 'production' })}>
            {DOWNLOAD_LINK_COPY.back}
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col">
            <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">{DOWNLOAD_LINK_COPY.title}</h1>
            <p className="text-ods-text-secondary text-h4">{DOWNLOAD_LINK_COPY.intro}</p>
          </div>
          <form
            noValidate
            onSubmit={onSubmit}
            className="flex flex-col gap-[var(--spacing-system-l)]"
            {...HUBSPOT_DO_NOT_COLLECT_FORM_PROPS}
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              label={DOWNLOAD_LINK_COPY.emailLabel}
              placeholder={DOWNLOAD_LINK_COPY.emailPlaceholder}
              error={emailError}
              disabled={request.isPending}
              {...form.register('email')}
            />
            <HoneypotField ref={honeypotRef} name={HONEYPOT_NAME} />
            <Button type="submit" variant="accent" fullWidth loading={request.isPending} disabled={request.isPending}>
              {DOWNLOAD_LINK_COPY.submit}
            </Button>
            <p className="text-ods-text-secondary text-h6">{DOWNLOAD_LINK_COPY.consent}</p>
          </form>
        </>
      )}
    </div>
  );
}
