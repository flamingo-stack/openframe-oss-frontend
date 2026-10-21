/**
 * The two loading gates (`npm run check:loading`) on small fixture trees: each rule fails the code it names and
 * passes the form the standard asks for, so a regex change cannot silently stop a gate from failing.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pageSkeletonReport } from '../../scripts/check-page-skeletons.mjs';
import { fullPageProblems, fullPageReport } from '../../scripts/check-skeleton-full-page.mjs';

const roots: string[] = [];

/** A fixture `src/` holding `files` (path relative to `src/` → source). */
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'loading-gates-'));
  roots.push(root);
  for (const [rel, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), source);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-skeleton-full-page', () => {
  const problems = (source: string) => fullPageProblems('x.tsx', source) as string[];

  it('fails a page size capped by a fold', () => {
    expect(problems('const n = Math.min(PAGE_SIZE, ROW_FOLD);')).toHaveLength(1);
    expect(problems('const n = Math.min(PAGE_SIZE, total);')).toHaveLength(0);
  });

  it('fails a typed count and passes a named one', () => {
    expect(problems('<Table skeletonRows={8} />')).toHaveLength(1);
    expect(problems('<RowSkeleton rows={4} />')).toHaveLength(1);
    expect(problems('function ListSkeleton() {\n  return Array.from({ length: 6 }, () => null);\n}')).toHaveLength(1);
    expect(problems('const rows = isLoading ? [0, 1, 2].map(i => i) : data;')).toHaveLength(1);
    expect(problems('<Table skeletonRows={DEVICES_PAGE_SIZE} />')).toHaveLength(0);
  });

  it('fails a count that does not say where it comes from', () => {
    expect(problems('<Table skeletonRows={rowsToDraw} />')).toHaveLength(1);
    expect(problems('<Table skeletonRows={skeletonRows} />')).toHaveLength(0);
    expect(problems('<Table skeletonRows={NOTES_SKELETON_ROWS} />')).toHaveLength(0);
  });

  it('fails an unmarked skeleton list and finds the mark in the item component', () => {
    const unmarked = tree({
      'app/list.tsx':
        'function Row() { return <div />; }\nexport function List() {\n  return Array.from({ length: LIST_PAGE_SIZE }, (_, i) => <Row key={i} />);\n}\n',
    });
    expect(fullPageReport(unmarked).problems).toHaveLength(1);
    const marked = tree({
      'app/row.tsx': 'export function Row() { return <div data-loading-item />; }\n',
      'app/list.tsx':
        'export function List() {\n  return Array.from({ length: LIST_PAGE_SIZE }, (_, i) => <Row key={i} />);\n}\n',
    });
    expect(fullPageReport(marked).problems).toHaveLength(0);
  });

  it('honours an opt-out', () => {
    expect(problems('// full-page-ok: fixed by design\n<Table skeletonRows={3} />')).toHaveLength(0);
  });
});

describe('check-page-skeletons', () => {
  it('fails a parent that picks a child skeleton the child draws itself', () => {
    const root = tree({
      'components/badge.tsx':
        "import { useLoadingScope } from 'x';\nexport function Badge() { const l = useLoadingScope(); return l ? <BadgeSkeleton /> : <span />; }\nexport function BadgeSkeleton() { return <span />; }\n",
      'app/(app)/thing/card.tsx':
        "import { BadgeSkeleton } from '@/components/badge';\nexport function Card({ loading }: { loading: boolean }) { return loading ? <BadgeSkeleton /> : null; }\n",
    });
    const { violations, warnings } = pageSkeletonReport(root);
    expect([...violations, ...warnings].join('\n')).toContain('BadgeSkeleton');
  });

  it('passes a parent that renders the component in a scope', () => {
    const root = tree({
      'components/badge.tsx':
        "import { useLoadingScope } from 'x';\nexport function Badge() { const l = useLoadingScope(); return l ? <BadgeSkeleton /> : <span />; }\nexport function BadgeSkeleton() { return <span />; }\n",
      'app/(app)/thing/card.tsx':
        "import { LoadingWhen } from 'x';\nimport { Badge } from '@/components/badge';\nexport function Card({ loading }: { loading: boolean }) { return <LoadingWhen loading={loading}><Badge /></LoadingWhen>; }\n",
    });
    const { violations, warnings } = pageSkeletonReport(root);
    expect([...violations, ...warnings]).toEqual([]);
  });

  it('fails a route loading file', () => {
    const root = tree({
      'app/(app)/thing/page.tsx': 'export default function Page() { return null; }\n',
      'app/(app)/thing/loading.tsx': 'export default function Loading() { return null; }\n',
    });
    expect(pageSkeletonReport(root).violations.join('\n')).toContain('loading');
  });
});
