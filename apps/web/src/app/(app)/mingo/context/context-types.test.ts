import { describe, expect, it } from 'vitest';
import { CONTEXT_ENTITY_KIND, CONTEXT_ENTITY_KINDS, CONTEXT_ENTITY_MARKER } from './context-types';

describe('context entity kinds and record types', () => {
  it('lists every kind once, in declaration order', () => {
    expect(CONTEXT_ENTITY_KINDS).toEqual(Object.values(CONTEXT_ENTITY_KIND));
    expect(new Set(CONTEXT_ENTITY_KINDS).size).toBe(CONTEXT_ENTITY_KINDS.length);
  });

  it('gives every kind its own record type', () => {
    const markers = CONTEXT_ENTITY_KINDS.map(kind => CONTEXT_ENTITY_MARKER[kind]);
    expect(markers.every(marker => typeof marker === 'string' && marker.length > 0)).toBe(true);
    expect(new Set(markers).size).toBe(markers.length);
  });

  it('keeps the record types the backend matches verbatim', () => {
    expect(CONTEXT_ENTITY_MARKER.KB_ARTICLE).toBe('kb');
    expect(CONTEXT_ENTITY_MARKER.KB_FOLDER).toBe('kbFolder');
    expect(CONTEXT_ENTITY_MARKER.SCHEDULED_SCRIPT).toBe('scheduledScript');
    expect(CONTEXT_ENTITY_MARKER.DEVICE).toBe('device');
  });
});
