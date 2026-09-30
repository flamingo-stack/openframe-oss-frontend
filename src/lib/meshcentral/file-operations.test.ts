import { describe, expect, it } from 'vitest';
import type { FileEntry } from './file-manager-types';
import { FileOperations } from './file-operations';

const file = (n: string): FileEntry => ({ n, t: 3 });
const folder = (n: string): FileEntry => ({ n, t: 2 });

describe('FileOperations.describeDeleteFailure', () => {
  const ops = new FileOperations();

  it('returns null when none of the requested names are in the listing', () => {
    expect(ops.describeDeleteFailure(['01-plain.txt'], [file('other.txt')])).toBeNull();
  });

  it('names the one item that survived a single delete', () => {
    expect(ops.describeDeleteFailure(['04-locked-uchg.txt'], [file('04-locked-uchg.txt'), file('other.txt')])).toBe(
      '"04-locked-uchg.txt" could not be deleted. It may be locked or in use.',
    );
  });

  it('counts survivors against the request and ignores unrelated entries', () => {
    expect(ops.describeDeleteFailure(['a', 'b', 'c'], [file('b'), file('unrelated')])).toBe(
      '1 of 3 items could not be deleted. They may be locked or in use.',
    );
  });

  it('warns that a surviving folder may be partly emptied', () => {
    expect(ops.describeDeleteFailure(['docs'], [folder('docs')])).toBe(
      '"docs" could not be deleted. It may be locked or in use. Some folder contents may have been removed.',
    );
    expect(ops.describeDeleteFailure(['docs', 'a', 'b'], [folder('docs'), file('a')])).toBe(
      '2 of 3 items could not be deleted. They may be locked or in use. Some folder contents may have been removed.',
    );
  });
});
