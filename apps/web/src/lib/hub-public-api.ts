/**
 * The hub's public API (the OpenFrame platform deployment), for surfaces with no `/content`
 * proxy behind them: the shared-auth host, whose gateway sends everything but `/auth` back to
 * this app.
 */
export const HUB_PUBLIC_API = 'https://content-api.openframe.ai/api';
