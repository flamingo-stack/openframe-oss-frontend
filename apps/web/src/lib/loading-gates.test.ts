/**
 * The two loading gates (`npm run check:loading`) on small fixture trees: every rule fails the code it names and
 * passes the form the standard asks for, so a regex change cannot silently stop a gate from failing.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pageSkeletonReport } from '../../scripts/check-page-skeletons.mjs';
import { fullPageProblems, fullPageReport } from '../../scripts/check-skeleton-full-page.mjs';
import { RULE_EXAMPLES } from '../../scripts/lib/source-scan.mjs';

type RuleExample = { rule: string; fail: Record<string, string>; pass: Record<string, string> };
const COUNT_RULES = new Set(['TYPED_COUNT', 'COUNT_SOURCE', 'COUNT_CAP', 'HIDDEN_ITEMS', 'ITEM_MARK', 'OPTIONAL_MARK']);

const roots: string[] = [];

/** A fixture project: `src/` holding `files` (paths relative to the project root, e.g. `src/app/x.tsx`). */
const INSTALLED_LIB = 'node_modules/@flamingo-stack/openframe-frontend-core/src';

function project(files: Record<string, string>, { lib = true } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'loading-gates-'));
  roots.push(root);
  // An installed lib with a src/ folder, as the real install ships (the gate fails when it is missing).
  const all = lib ? { [`${INSTALLED_LIB}/index.ts`]: 'export {};\n', ...files } : files;
  for (const [rel, source] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), source);
  }
  return join(root, 'src');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Everything the one-switch gate reports for a fixture project. */
function pageProblems(files: Record<string, string>, options?: { lib?: boolean }): string {
  const { violations, warnings } = pageSkeletonReport(project(files, options));
  return [...violations, ...warnings].join('\n');
}

const BADGE = `import { useLoadingScope } from 'x';
export function Badge() { const l = useLoadingScope(); return l ? <BadgeSkeleton /> : <span />; }
export function BadgeSkeleton() { return <span />; }
`;

describe('check-page-skeletons', () => {
  it('ONE SWITCH: fails a parent that picks the skeleton of a child that draws itself', () => {
    const report = pageProblems({
      'src/components/badge.tsx': BADGE,
      'src/app/(app)/thing/card.tsx':
        "import { BadgeSkeleton } from '@/components/badge';\nexport function Card({ loading }: { loading: boolean }) { return loading ? <BadgeSkeleton /> : null; }\n",
    });
    expect(report).toContain('<BadgeSkeleton> rendered outside Badge');
  });

  it('ONE SWITCH: passes a parent that renders the child in a scope', () => {
    const report = pageProblems({
      'src/components/badge.tsx': BADGE,
      'src/app/(app)/thing/card.tsx':
        "import { LoadingWhen } from 'x';\nimport { Badge } from '@/components/badge';\nexport function Card({ loading }: { loading: boolean }) { return <LoadingWhen loading={loading}><Badge /></LoadingWhen>; }\n",
    });
    expect(report).toBe('');
  });

  it('ONE SWITCH: reads the installed lib to learn which lib components switch themselves', () => {
    const lib = 'node_modules/@flamingo-stack/openframe-frontend-core/src/components/ui/model.tsx';
    const report = pageProblems({
      [lib]: BADGE.replaceAll('Badge', 'Model'),
      'src/app/(app)/thing/card.tsx':
        "import { ModelSkeleton } from '@flamingo-stack/openframe-frontend-core';\nexport function Card() { return <ModelSkeleton />; }\n",
    });
    expect(report).toContain('<ModelSkeleton> rendered outside Model');
  });

  it('NO SCOPE SWITCH: fails a parent that picks the skeleton of a child that never switches', () => {
    const report = pageProblems({
      'src/components/badge.tsx':
        'export function Badge() { return <span />; }\nexport function BadgeSkeleton() { return <span />; }\n',
      'src/app/(app)/thing/card.tsx': 'export function Card() { return <BadgeSkeleton />; }\n',
    });
    expect(report).toContain('which never switches itself');
  });

  it('fails a route loading file and a whole-view skeleton', () => {
    const report = pageProblems({
      'src/app/(app)/thing/page.tsx': 'export default function Page() { return null; }\n',
      'src/app/(app)/thing/loading.tsx': 'export default function Loading() { return null; }\n',
      'src/components/thing-view.tsx': 'export function ThingViewSkeleton() { return null; }\n',
    });
    expect(report).toContain('a route-level loading.tsx');
    expect(report).toContain('ThingViewSkeleton (a whole-view skeleton)');
  });

  it('fails skeleton primitives drawn by page code', () => {
    const report = pageProblems({
      'src/app/(app)/thing/page.tsx':
        "import { TextLineSkeleton } from 'x';\nexport default function Page() { return <TextLineSkeleton />; }\n",
    });
    expect(report).toContain('TextLineSkeleton');
  });

  it.each([
    ['a spinner', '<div className="animate-spin" />', 'a spinner as a loading state'],
    ['a loader component', '<PageLoader />', 'a loader component'],
    ['a Spinner', '<Spinner />', 'a loader component'],
    ['"Loading…" text', '<p>Loading devices…</p>', '"Loading'],
    ['"Loading" text', '<p>Loading data</p>', '"Loading" text'],
    ['an own pulse', '<div className="animate-pulse" />', 'a pulse or skeleton colour'],
    ['a null fallback', '<Suspense fallback={null}><X /></Suspense>', 'a Suspense fallback of null'],
    ['a Suspense with no fallback', '<Suspense><X /></Suspense>', 'a Suspense with no fallback'],
    ['nothing while loading', '{loading ? null : <X />}', 'nothing drawn while loading'],
  ])('fails %s', (_name, jsx, expected) => {
    const report = pageProblems({
      'src/components/thing.tsx': `export function Thing({ loading }: { loading: boolean }) {\n  return (\n    <div>\n      ${jsx}\n    </div>\n  );\n}\n`,
    });
    expect(report).toContain(expected);
  });

  it('fails "return null" while loading, and passes a data value set to null', () => {
    expect(
      pageProblems({
        'src/components/thing.tsx':
          'export function Thing({ loading }: { loading: boolean }) {\n  if (loading) return null;\n  return <div />;\n}\n',
      }),
    ).toContain('nothing drawn while loading');
    expect(
      pageProblems({
        'src/components/thing.tsx':
          'export function Thing({ loading, x }: { loading: boolean; x: string }) {\n  const value = loading ? null : x;\n  return <div>{value}</div>;\n}\n',
      }),
    ).toBe('');
  });

  it('exempts a next/dynamic loading arrow only inside dynamic()', () => {
    const lib = 'node_modules/@flamingo-stack/openframe-frontend-core/src/components/ui/model.tsx';
    const model = BADGE.replaceAll('Badge', 'Model');
    expect(
      pageProblems({
        [lib]: model,
        'src/components/lazy.tsx':
          "import dynamic from 'next/dynamic';\nexport const Model = dynamic<object>(() => import('x'), { ssr: false, loading: () => <ModelSkeleton /> });\n",
      }),
    ).toBe('');
    expect(
      pageProblems({
        [lib]: model,
        'src/components/other.tsx': 'export const options = { loading: () => <ModelSkeleton /> };\n',
      }),
    ).toContain('<ModelSkeleton> rendered outside Model');
  });

  it('fails a skeleton the installed lib marks @deprecated', () => {
    const lib = 'node_modules/@flamingo-stack/openframe-frontend-core/src/components/loading/old.tsx';
    const report = pageProblems({
      [lib]:
        '/**\n * @deprecated Render the form in a scope.\n */\n// loading-standard-ok: kept for hosts\nexport function OldFormSkeleton() { return null; }\n',
      'src/components/thing.tsx': 'export function Thing() { return <OldFormSkeleton />; }\n',
    });
    expect(report).toContain('<OldFormSkeleton> is deprecated in the lib');
  });

  it.each([
    [
      'a spinner keyed on a read',
      'if (isFetching) return <Loader2 className="animate-spin" />;',
      'a progress icon belongs to an action',
    ],
    [
      'a Suspense with attributes and no fallback',
      'return <Suspense key="k"><X /></Suspense>;',
      'a Suspense with no fallback',
    ],
    ['"Loading" as a placeholder', 'return <Input placeholder="Loading devices" />;', '"Loading" as a placeholder'],
    ['null on a fetching flag', 'return isFetching ? null : <Row />;', 'nothing drawn while loading'],
    [
      'null while the read is pending',
      'const { data } = useThing();\n  if (!data) return null;\n  return <Row />;',
      'nothing drawn while the read is pending',
    ],
    [
      'a switch on the prop alone',
      'if (loading) return <RowSkeleton />;\n  return <Row />;',
      'a switch on the loading prop alone',
    ],
  ])('fails %s', (_name, body, expected) => {
    const report = pageProblems({
      'src/components/thing.tsx': `export function Thing({ loading, isFetching }: { loading: boolean; isFetching: boolean }) {\n  ${body}\n}\n`,
    });
    expect(report).toContain(expected);
  });

  it('passes return null after the read has answered, and an action spinner', () => {
    expect(
      pageProblems({
        'src/components/thing.tsx':
          'export function Thing() {\n  const { data } = useLazyLoadQuery(q, {});\n  if (!data) return null;\n  return <Row />;\n}\n',
      }),
    ).toBe('');
    expect(
      pageProblems({
        'src/components/thing.tsx':
          'export function Thing({ isSubmitting }: { isSubmitting: boolean }) {\n  return <Button>{isSubmitting && <Loader2 className="animate-spin" />}Save</Button>;\n}\n',
      }),
    ).toBe('');
  });

  it('fails when the installed lib has no src to index', () => {
    expect(
      pageProblems({ 'src/components/thing.tsx': 'export function Thing() { return <div />; }\n' }, { lib: false }),
    ).toContain('the installed lib ships no src/');
  });

  it('honours the opt-out marker', () => {
    const report = pageProblems({
      'src/components/thing.tsx':
        'export function Thing() {\n  // loading-standard-ok: an action in progress\n  return <div className="animate-spin" />;\n}\n',
    });
    expect(report).toBe('');
  });
});

describe('every engine rule through the two gates', () => {
  /** What the gate that runs `rule` reports for a fixture tree (paths relative to `src/`). */
  const reportFor = (rule: string, files: Record<string, string>) => {
    const tree = Object.fromEntries(Object.entries(files).map(([rel, source]) => [`src/${rel}`, source]));
    return COUNT_RULES.has(rule) ? fullPageReport(project(tree)).problems.join('\n') : pageProblems(tree);
  };

  it.each((RULE_EXAMPLES as RuleExample[]).map(example => [example.rule, example] as const))(
    '%s fails its example and passes the standard form',
    (rule, example) => {
      expect(reportFor(rule, example.fail)).toContain(`[${rule}]`);
      expect(reportFor(rule, example.pass)).not.toContain(`[${rule}]`);
    },
  );
});

describe('check-skeleton-full-page', () => {
  const problems = (source: string) => fullPageProblems('x.tsx', source) as string[];

  it('CAP: fails a page size capped by a fold, a constant or a number; passes the last page', () => {
    expect(problems('const n = Math.min(PAGE_SIZE, ROW_FOLD);')).toHaveLength(1);
    expect(problems('const n = Math.min(pageSize, MAX_VISIBLE);')).toHaveLength(1);
    expect(problems('const n = Math.min(pageSize, 8);')).toHaveLength(1);
    expect(problems('const n = Math.min(PAGE_SIZE, total);')).toHaveLength(0);
  });

  it('TYPED COUNT: fails a typed count on any skeleton count prop, passes a named one', () => {
    expect(problems('<Table skeletonRows={8} />')).toHaveLength(1);
    expect(problems('<Picker loadingRows={8} />')).toHaveLength(1);
    expect(problems('<RowSkeleton rows={4} />')).toHaveLength(1);
    expect(problems('<Table skeletonRows={DEVICES_PAGE_SIZE} />')).toHaveLength(0);
  });

  it('TYPED COUNT: fails literal-length lists in a skeleton, a loading branch or a module constant used while loading', () => {
    expect(problems('function ListSkeleton() {\n  return Array.from({ length: 6 }, () => null);\n}')).toHaveLength(1);
    expect(problems('const rows = isLoading ? [0, 1, 2].map(i => i) : data;')).toHaveLength(1);
    expect(problems('const ROWS = Array.from({ length: 5 });\nconst rows = loading ? ROWS : data;')).toHaveLength(1);
    expect(problems('const ROWS = Array.from({ length: 5 });\nconst rows = data;')).toHaveLength(0);
  });

  it('COUNT SOURCE: fails a count that does not say where it comes from; passes a pass-through', () => {
    expect(problems('<Table skeletonRows={rowsToDraw} />')).toHaveLength(1);
    expect(problems('<Table skeletonRows={skeletonRows} />')).toHaveLength(0);
    expect(problems('<Table skeletonRows={NOTES_SKELETON_ROWS} />')).toHaveLength(0);
  });

  it('ITEM MARK: finds the mark through the item component import, on both lists', () => {
    const marked = project({
      'src/app/row.tsx': 'export function Row() { return <div data-loading-item />; }\n',
      'src/app/list.tsx':
        "import { Row } from './row';\nexport function List({ loading, items }: { loading: boolean; items: string[] }) {\n  return loading\n    ? Array.from({ length: LIST_PAGE_SIZE }, (_, i) => <Row key={i} />)\n    : items.map(item => <Row key={item} />);\n}\n",
    });
    expect(fullPageReport(marked).problems).toEqual([]);
  });

  it('ITEM MARK: fails an unmarked skeleton list, and an unmarked loaded list beside a marked skeleton', () => {
    const unmarked = project({
      'src/app/list.tsx':
        'function Row() { return <div />; }\nexport function List() {\n  return Array.from({ length: LIST_PAGE_SIZE }, (_, i) => <Row key={i} />);\n}\n',
    });
    expect(fullPageReport(unmarked).problems).toHaveLength(1);
    const loadedUnmarked = project({
      'src/app/list.tsx':
        'export function List({ loading, items }: { loading: boolean; items: string[] }) {\n  return loading\n    ? Array.from({ length: LIST_PAGE_SIZE }, (_, i) => <div key={i} data-loading-item />)\n    : items.map(item => <div key={item} />);\n}\n',
    });
    expect(fullPageReport(loadedUnmarked).problems.join('\n')).toContain('the loaded list');
  });

  it('ITEM MARK: a same-named component elsewhere does not lend its mark', () => {
    const other = project({
      'src/app/other/row.tsx': 'export function Row() { return <div data-loading-item />; }\n',
      'src/app/list/row.tsx': 'export function Row() { return <div />; }\n',
      'src/app/list/list.tsx':
        "import { Row } from './row';\nexport function List() {\n  return Array.from({ length: LIST_PAGE_SIZE }, (_, i) => <Row key={i} />);\n}\n",
    });
    expect(fullPageReport(other).problems).toHaveLength(1);
  });

  it('OPTIONAL MARK: fails a part left out while loading without the marker; passes errors, pairs and ternaries', () => {
    const scope = 'const loading = useLoadingScope();\n';
    expect(problems(`${scope}return <div>{!loading && <Banner />}</div>;`)).toHaveLength(1);
    expect(
      problems(`${scope}return <div>{!loading && <div data-loading-optional><Banner /></div>}</div>;`),
    ).toHaveLength(0);
    expect(problems(`${scope}return <div>{!loading && error && <LoadError />}</div>;`)).toHaveLength(0);
    expect(problems(`${scope}return <div>{loading && <Bar />}\n{!loading && <Value />}</div>;`)).toHaveLength(0);
    expect(problems(`${scope}return <div>{!loading && rows.length === 0 ? <Empty /> : <List />}</div>;`)).toHaveLength(
      0,
    );
  });

  it('COUNT SOURCE: fails a skeleton count laundered through another constant', () => {
    expect(
      problems('const CARDS = 6;\nfunction ListSkeleton() {\n  return Array.from({ length: CARDS }, () => null);\n}'),
    ).toHaveLength(1);
    expect(
      problems(
        'function ListSkeleton() {\n  return Array.from({ length: CARDS_SKELETON_COUNT }, () => <div key={0} data-loading-item />);\n}',
      ),
    ).toHaveLength(0);
  });

  it('ITEM MARK: checks a list drawn from a pageSize variable too', () => {
    const unmarked = project({
      'src/app/list.tsx':
        'export function List({ pageSize }: { pageSize: number }) {\n  return Array.from({ length: pageSize }, (_, i) => <div key={i} />);\n}\n',
    });
    expect(fullPageReport(unmarked).problems).toHaveLength(1);
  });

  it('OPTIONAL MARK: fails a part keyed on a read field in a switching component', () => {
    const scope = 'const loading = useLoadingScope();\n';
    expect(problems(`${scope}return <div>{record?.extra && <Aside />}</div>;`)).toHaveLength(1);
    expect(problems(`${scope}return <div>{record?.extra && <aside data-loading-optional />}</div>;`)).toHaveLength(0);
  });

  it('honours the opt-out marker', () => {
    expect(problems('// full-page-ok: fixed by design\n<Table skeletonRows={3} />')).toHaveLength(0);
  });
});
