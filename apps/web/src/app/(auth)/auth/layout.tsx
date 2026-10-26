import { MaximizeDesktopWindow } from '@/app/components/maximize-desktop-window';
import { routeTitle } from '@/lib/route-title';
import { AuthAnnouncementBar } from './components/auth-announcement-bar';
import { RedditClickIdCapture } from './components/reddit-click-id-capture';

export const metadata = {
  // Absolute, like the (app) titles: as a plain string the root layout's
  // template appended its own suffix to a name that already carried one
  // ("OpenFrame - Authentication | OpenFrame").
  title: routeTitle('Authentication'),
  description: 'Sign in to your OpenFrame account',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The desktop shell opens out here, at sign-in and registration, and the setup wizard after them keeps it. */}
      <MaximizeDesktopWindow />
      <RedditClickIdCapture />
      <AuthAnnouncementBar />
      {/* No boundary here: each page that reads the URL owns its Suspense, with itself in a loading scope as the
          fallback, so nothing on an auth page waits on an empty frame. */}
      <div className="of-auth-pages">{children}</div>
    </>
  );
}
