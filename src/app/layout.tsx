import type { Metadata, Viewport } from 'next';
import { PublicEnvScript } from 'next-runtime-env';
import { Suspense } from 'react';
import './globals.css';
import '@flamingo-stack/openframe-frontend-core/styles';
import { DevTicketObserver } from '@/app/(auth)/auth/components/dev-ticket-observer';
import { azeretMono, dmSans } from '@/lib/fonts';
import { NatsAppProvider } from '@/lib/nats/nats-app-provider';
import { sidebarWidthFoucScript } from '@/lib/navigation-sidebar-state';
import { Toaster } from '@/lib/openframe-core-ui';
import { FeatureFlagsLoader } from '../components/feature-flags-loader';
import { RouteGuard } from '../components/route-guard';
import { isAuthEnabled } from '../lib/app-mode';
import { QueryClientProvider } from '../lib/query-client-provider';
import { RelayProvider } from '../lib/relay';
import { BiometricLockBoundary } from './components/biometric-lock-boundary';
import { DeploymentInitializer } from './components/deployment-initializer';
import { EmbedShimRegistration } from './components/embed-shim-registration';
import { GoogleTagManager } from './components/google-tag-manager';
import { NativeShellInitializer } from './components/native-shell-initializer';
import { NotificationsDataProvider } from './components/notifications/notifications-data-provider';
import { OfflineBanner } from './components/offline-banner';
import { RegistrationAttributionCapture } from './components/registration-attribution-capture';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://openframe.ai'),

  title: {
    default: 'OpenFrame - AI-Driven Open-Source OS for MSPs',
    template: '%s | OpenFrame',
  },

  description:
    'Swap bloated vendor tools for open ones. Automate the boring crap. Take your margin back. AI-driven open-source OS for MSPs.',

  keywords: ['OpenFrame', 'MSP', 'managed service provider', 'open source', 'AI', 'automation', 'vendor tools', 'RMM'],

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://openframe.ai',
    siteName: 'OpenFrame',
    title: 'OpenFrame - AI-Driven Open-Source OS for MSPs',
    description:
      'Swap bloated vendor tools for open ones. Automate the boring crap. Take your margin back. AI-driven open-source OS for MSPs.',
    images: [
      {
        url: '/assets/openframe/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OpenFrame - AI-Driven Open-Source OS for MSPs',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'OpenFrame - AI-Driven Open-Source OS for MSPs',
    description: 'Swap bloated vendor tools for open ones. Automate the boring crap. Take your margin back.',
    images: ['/assets/openframe/twitter-image.png'],
  },

  icons: {
    icon: [
      { url: '/assets/openframe/favicon.svg', type: 'image/svg+xml' },
      { url: '/assets/openframe/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/assets/openframe/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/openframe/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: [{ url: '/assets/openframe/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/assets/openframe/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      {
        rel: 'mask-icon',
        url: '/assets/openframe/favicon.svg',
      },
    ],
  },

  manifest: '/assets/openframe/site.webmanifest',

  other: {
    'theme-color': '#161616', // ODS background color (--ods-system-greys-background)
  },
};

// The viewport MUST be declared here, not as a manual <meta> in <head>: with no
// `viewport` export Next injects its own default tag after the manual one, and
// WebKit applies the last tag — which silently dropped maximum-scale and
// viewport-fit. Scale is pinned only in static-export (native WebView shell)
// builds to kill WebKit's focus-on-input auto-zoom; the web build keeps
// default scaling so browser pinch-zoom stays available.
export function generateViewport(): Viewport {
  const isStaticExport = process.env.OPENFRAME_BUILD_TARGET === 'export';
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    ...(isStaticExport ? { maximumScale: 1, userScalable: false } : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Static-export (native-shell) builds have no server to populate
  // next-runtime-env, so the Capacitor/Tauri shell injects window.__ENV before
  // the bundle loads. The SSR/standalone web build keeps <PublicEnvScript />.
  const isStaticExport = process.env.OPENFRAME_BUILD_TARGET === 'export';
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${azeretMono.variable} ${dmSans.variable}`}>
      <head>
        {!isStaticExport && <PublicEnvScript />}
        {/* Seeds the sidebar width before first paint so the real `NavigationSidebar`
            honors the persisted collapsed state instead of flashing expanded. The
            server cannot read localStorage, so this is the only channel by which the
            preference reaches the first frame — and the only thing that keeps the
            width out of the markup, where it was a hydration mismatch. */}
        {/* biome-ignore lint/style/useNamingConvention: React's dangerouslySetInnerHTML requires the __html key */}
        <script dangerouslySetInnerHTML={{ __html: sidebarWidthFoucScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-screen antialiased font-body" data-app-type="openframe">
        <GoogleTagManager />
        <RegistrationAttributionCapture />
        <EmbedShimRegistration />
        <DeploymentInitializer />
        <NativeShellInitializer />
        <RelayProvider>
          <QueryClientProvider>
            {/* Its own boundary, and it is load-bearing. This reads `?devTicket=`,
                and `useSearchParams()` bails out to client rendering during the
                static prerender — which `next build` treats as an error unless
                there is a Suspense boundary to bail out to. Sitting in the root
                layout, it is above every page, so without this the build fails on
                EVERY statically generated page rather than on anything that looks
                related to dev tickets. Only a production build raises it; a dev
                build renders nothing statically and stays quiet. */}
            {isAuthEnabled() && (
              <Suspense fallback={null}>
                <DevTicketObserver />
              </Suspense>
            )}
            <NatsAppProvider>
              <BiometricLockBoundary>
                <FeatureFlagsLoader>
                  <NotificationsDataProvider>
                    <RouteGuard>
                      {/* No app-wide Suspense boundary around `children` — the one
                          that used to be here drew `AppShellSkeleton`, and with the
                          skeleton retired an empty one would only widen the blast
                          radius: anything suspending below would blank the chrome
                          along with the page. The boundary inside `<main>` catches
                          that in the content area instead, and each root-layout
                          component that reads search params carries its own. */}
                      <div className="relative flex min-h-screen flex-col">{children}</div>
                    </RouteGuard>
                  </NotificationsDataProvider>
                </FeatureFlagsLoader>
              </BiometricLockBoundary>
            </NatsAppProvider>
          </QueryClientProvider>
        </RelayProvider>
        <OfflineBanner />
        <Toaster />
      </body>
    </html>
  );
}
