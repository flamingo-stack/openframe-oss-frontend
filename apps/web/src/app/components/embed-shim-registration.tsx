'use client';

import { registerEmbedAuthAdapter } from '@/lib/embed-auth-adapter';
import { registerEmbedShims } from '@/lib/register-embed-shims';

registerEmbedShims();
// Here so every page has it from the root layout's load (`lib/embed-auth-adapter.ts` has why).
registerEmbedAuthAdapter();

export function EmbedShimRegistration() {
  return null;
}
