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

  it('a waiting update carries the loader glyph, as one in progress does: it is not over yet', () => {
    const waiting = renderToStaticMarkup(<SoftwareActionStatusTag status={SoftwareActionStatus.WAITING} />);
    const success = renderToStaticMarkup(<SoftwareActionStatusTag status={SoftwareActionStatus.COMPLETED} />);
    expect(waiting).toContain('<svg');
    expect(success).not.toContain('<svg');
  });

  it('the Status funnel says the same word', () => {
    expect(softwareActionStatusLabel(SoftwareActionStatus.WAITING)).toBe('Waiting');
  });

  it('a status this build does not know still shows as it came', () => {
    expect(renderToStaticMarkup(<SoftwareActionStatusTag status="PAUSED" />)).toContain('PAUSED');
  });
});
