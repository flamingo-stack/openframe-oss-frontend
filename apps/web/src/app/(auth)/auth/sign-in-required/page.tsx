import { UnauthorizedOverlay } from '@/app/components/unauthorized-overlay';
import { routeTitle } from '@/lib/route-title';

export const metadata = { title: routeTitle('Sign in required') };

export default function SignInRequiredPage() {
  return <UnauthorizedOverlay preserveWorkspaceHint />;
}
