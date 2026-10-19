/**
 * The environment a tenant host belongs to, named for the super user strip's
 * chip: "Production environment", "QA environment", ...
 *
 * Read off the host, because the bundle does not know where it runs: one web
 * image serves every environment, and the native shells learn their host at
 * login. The SaaS environments share one shape, `<tenant>.<env>.openframe.build`
 * with production at `<tenant>.openframe.ai`, so the label is the env segment
 * itself (dev, dev10, qa, stage) and needs no list to maintain. A host outside
 * that shape (self-hosted, a custom domain) names no environment: the strip
 * then shows no chip rather than a wrong one.
 */
const PRODUCTION_HOST = /(^|\.)openframe\.ai$/i;
const ENVIRONMENT_HOST = /\.([a-z0-9-]+)\.openframe\.build$/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)$/i;

export function environmentLabel(hostname: string): string | undefined {
  if (PRODUCTION_HOST.test(hostname)) return 'Production environment';
  const env = ENVIRONMENT_HOST.exec(hostname)?.[1];
  if (env) return `${env.toUpperCase()} environment`;
  if (LOCAL_HOST.test(hostname)) return 'Local environment';
  return undefined;
}
