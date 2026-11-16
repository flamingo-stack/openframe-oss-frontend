// Next runs this before hydration in every client build. Error reporting decides for itself whether
// this deployment reports (lib/error-reporting.ts).
import { initBrowserErrorReporting } from '@/lib/error-reporting-client';

initBrowserErrorReporting();
