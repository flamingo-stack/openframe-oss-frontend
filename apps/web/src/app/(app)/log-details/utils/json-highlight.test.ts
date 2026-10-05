import { describe, expect, it } from 'vitest';
import { formatJson, type JsonToken, tokenizeJson } from './json-highlight';

const joined = (tokens: JsonToken[]) => tokens.map(t => t.text).join('');
const ofType = (tokens: JsonToken[], type: JsonToken['type']) => tokens.filter(t => t.type === type).map(t => t.text);

describe('tokenizeJson', () => {
  it('reassembles to the exact input', () => {
    const json = formatJson({ a: 'x', b: [1, true, null], c: { 'd e': -2.5e3 } });

    expect(joined(tokenizeJson(json))).toBe(json);
  });

  it('tells keys from string values and colours scalars', () => {
    const tokens = tokenizeJson(formatJson({ name: 'Mingo', exit_code: 0, timed_out: false, error: null }));

    expect(ofType(tokens, 'key')).toEqual(['name', 'exit_code', 'timed_out', 'error']);
    expect(ofType(tokens, 'string')).toEqual(['Mingo']);
    expect(ofType(tokens, 'scalar')).toEqual(['0', 'false', 'null']);
  });

  it('keeps quotes and the colon as punctuation', () => {
    const tokens = tokenizeJson('{"k": "v"}');

    expect(tokens).toEqual([
      { type: 'punct', text: '{' },
      { type: 'punct', text: '"' },
      { type: 'key', text: 'k' },
      { type: 'punct', text: '"' },
      { type: 'punct', text: ':' },
      { type: 'punct', text: ' ' },
      { type: 'punct', text: '"' },
      { type: 'string', text: 'v' },
      { type: 'punct', text: '"' },
      { type: 'punct', text: '}' },
    ]);
  });

  it('does not split a string on an escaped quote, colon or newline', () => {
    const json = formatJson({ output: 'say "hi": done\n', 'we:ird': 'x' });
    const tokens = tokenizeJson(json);

    expect(ofType(tokens, 'string')).toEqual(['say \\"hi\\": done\\n', 'x']);
    expect(ofType(tokens, 'key')).toEqual(['output', 'we:ird']);
    expect(joined(tokens)).toBe(json);
  });

  it('treats a string element of an array as a value, not a key', () => {
    expect(ofType(tokenizeJson(formatJson({ args: ['--greeting', 'hi'] })), 'string')).toEqual(['--greeting', 'hi']);
  });

  it('does not colour digits inside a string', () => {
    expect(ofType(tokenizeJson(formatJson({ id: 'abc123' })), 'scalar')).toEqual([]);
  });
});
