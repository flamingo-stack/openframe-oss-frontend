import type { Metadata } from 'next';
import { routeTitle } from '@/lib/route-title';

export { default } from '@/app/(app)/route-title-layout';

export const metadata: Metadata = { title: routeTitle('Customers') };
