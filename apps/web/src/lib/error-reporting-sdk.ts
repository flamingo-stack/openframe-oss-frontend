// The slice of the SDK `error-reporting.ts` loads on demand: importing the package whole keeps replay and feedback.
export { captureException, init, setTag, setUser } from '@sentry/browser';
