import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { SoftwareActionStatusTag, softwareActionStatusLabel } from './software-action-status-tag';

describe('SoftwareActionStatusTag', () => {
  it('words an update on hold on a device as Waiting, not the raw enum', () => {
    const html = renderToStaticMarkup(<SoftwareActionStatusTag status={SoftwareActionStatus.WAITING} />);
    expect(html).toContain('Waiting');
    expect(html).not.toContain('WAITING');
  });

  it('the Status funnel says the same word', () => {
    expect(softwareActionStatusLabel(SoftwareActionStatus.WAITING)).toBe('Waiting');
  });

  it('a status this build does not know still shows as it came', () => {
    expect(renderToStaticMarkup(<SoftwareActionStatusTag status="PAUSED" />)).toContain('PAUSED');
  });
});
