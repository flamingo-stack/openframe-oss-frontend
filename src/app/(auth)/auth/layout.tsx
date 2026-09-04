import { routeTitle } from '@/lib/route-title';
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
      <RedditClickIdCapture />
      {children}
    </>
  );
}
