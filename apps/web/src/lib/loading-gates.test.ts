/**
 * The loading gate's WIRING (`scripts/lib/loading-gate.mjs`, run as `npm run check:loading`): the installed lib's
 * engine is reached, its `CONFIGS.frontend` applies (reported trees, page code), the installed lib's source is indexed
 * and its absence fails. The rules themselves are covered by the engine's own examples (`RULE_EXAMPLES`, run here
 * through this entry so the frontend config is proved to keep every rule working) and by the lib's test.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadingReport, RULE_EXAMPLES } from '../../scripts/lib/loading-gate.mjs';

type RuleExample = { rule: string; fail: Record<string, string>; pass: Record<string, string> };

const INSTALLED_LIB = 'node_modules/@flamingo-stack/openframe-frontend-core/src';
const roots: string[] = [];

/** A fixture app: `files` relative to the app root (`src/…`, the installed lib under `node_modules/…`). */
function report(files: Record<string, string>, { lib = true } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'loading-gate-'));
  roots.push(root);
  const all = lib ? { [`${INSTALLED_LIB}/index.ts`]: 'export {};\n', ...files } : files;
  for (const [rel, source] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), source);
  }
  return (loadingReport(join(root, 'src')) as string[]).join('\n');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const MODEL = `import { useLoadingScope } from 'x';
export function Model() { const l = useLoadingScope(); return l ? <ModelSkeleton /> : <span />; }
export function ModelSkeleton() { return <span />; }
`;

describe('the loading gate', () => {
  it('reports a finding as file:line: message [RULE]', () => {
    expect(
      report({ 'src/components/thing.tsx': 'export function T() {\n  return <div className="animate-spin" />;\n}\n' }),
    ).toMatch(/^components\/thing\.tsx:2: .+ \[SPINNER\]$/);
  });

  it('reads the installed lib to learn which lib components switch themselves', () => {
    expect(
      report({
        [`${INSTALLED_LIB}/components/ui/model.tsx`]: MODEL,
        'src/components/card.tsx':
          "import { ModelSkeleton } from '@flamingo-stack/openframe-frontend-core';\nexport function Card() { return <ModelSkeleton />; }\n",
      }),
    ).toContain('[ONE_SWITCH]');
  });

  it('fails when the installed lib has no src to index', () => {
    expect(
      report({ 'src/components/thing.tsx': 'export function T() { return <div />; }\n' }, { lib: false }),
    ).toContain('the installed lib ships no src/');
  });

  it('reports only app/, components/, lib/ and hooks/', () => {
    expect(
      report({ 'src/stories/thing.tsx': 'export function T() { return <div className="animate-spin" />; }\n' }),
    ).toBe('');
  });

  it('applies the page code to route files, and lets lib/ render a component skeleton', () => {
    const found = report({
      'src/app/thing/page.tsx': 'export default function Page() { return null; }\n',
      'src/app/thing/loading.tsx': 'export default function Loading() { return null; }\n',
      [`${INSTALLED_LIB}/components/ui/model.tsx`]: MODEL,
      'src/lib/registry.tsx':
        "import { ModelSkeleton } from '@flamingo-stack/openframe-frontend-core';\nexport const entry = { skeleton: () => <ModelSkeleton />, render: () => <Model /> };\n",
    });
    expect(found).toContain('app/thing/loading.tsx:1: a route-level loading.tsx');
    expect(found).not.toContain('lib/registry.tsx');
  });
});

describe('every engine rule through the gate', () => {
  /** A rule example's tree (paths relative to `src/`) as a fixture app. */
  const reportFor = (files: Record<string, string>) =>
    report(Object.fromEntries(Object.entries(files).map(([rel, source]) => [`src/${rel}`, source])));

  it.each((RULE_EXAMPLES as RuleExample[]).map(example => [example.rule, example] as const))(
    '%s fails its example and passes the standard form',
    (rule, example) => {
      expect(reportFor(example.fail)).toContain(`[${rule}]`);
      expect(reportFor(example.pass)).not.toContain(`[${rule}]`);
    },
  );
});
