import { describe, expect, it } from 'vitest';
import { rawIdOf, rawIdOfType } from './relay-id';

const RAW_TICKET_ID = '665f1c2ab3e4d5f6a7b8c9d1';
/** base64url('Ticket:665f1c2ab3e4d5f6a7b8c9d1'), unpadded, as the ai-agent emits it. */
const TICKET_GLOBAL_ID = 'VGlja2V0OjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMQ';
/** A raw ObjectId whose base64 decode happens to contain a colon. */
const COLON_DECODING_RAW_ID = 'a29957e94b8c53873a46301e';

describe('rawIdOfType', () => {
  it('unwraps a global id of the given type', () => {
    expect(rawIdOfType('Ticket', TICKET_GLOBAL_ID)).toBe(RAW_TICKET_ID);
  });

  it('leaves a raw id as is', () => {
    expect(rawIdOfType('Ticket', RAW_TICKET_ID)).toBe(RAW_TICKET_ID);
  });

  it('leaves a raw id that decodes to something with a colon as is, which rawIdOf does not', () => {
    expect(rawIdOf(COLON_DECODING_RAW_ID)).not.toBe(COLON_DECODING_RAW_ID);
    expect(rawIdOfType('Ticket', COLON_DECODING_RAW_ID)).toBe(COLON_DECODING_RAW_ID);
  });

  it('leaves a global id of another type as is', () => {
    expect(rawIdOfType('Dialog', TICKET_GLOBAL_ID)).toBe(TICKET_GLOBAL_ID);
  });
});
