import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SoftwareAutoUpdateStatus } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { AutoUpdateStatusValue } from './auto-update-status';

const text = (status: string | null) => renderToStaticMarkup(<AutoUpdateStatusValue status={status} />);

describe('AutoUpdateStatusValue', () => {
  it('a policy on or off reads On / Off', () => {
    expect(text(SoftwareAutoUpdateStatus.ON)).toContain('On');
    expect(text(SoftwareAutoUpdateStatus.OFF)).toContain('Off');
  });

  it('a title with no package says so', () => {
    expect(text(SoftwareAutoUpdateStatus.NO_PACKAGE)).toContain('No package found');
  });

  it('a copy installed by hand, an unknown state and none at all draw the empty mark', () => {
    for (const status of [SoftwareAutoUpdateStatus.NEEDS_ADOPTION, 'SOMETHING_NEW', null]) {
      expect(text(status)).toContain(EMPTY_VALUE);
    }
  });
});
