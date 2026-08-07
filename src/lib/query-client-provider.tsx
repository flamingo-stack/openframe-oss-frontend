'use client';

import { QueryClientProvider as TanstackQueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { getQueryClient } from './query-client';

export function QueryClientProvider({ children }: { children: ReactNode }) {
  // Seeded through `useState` so a server render still gets its own client (see
  // `query-client.ts`), while the browser reuses the one non-React callers hold.
  const [queryClient] = useState(getQueryClient);

  return <TanstackQueryClientProvider client={queryClient}>{children}</TanstackQueryClientProvider>;
}
