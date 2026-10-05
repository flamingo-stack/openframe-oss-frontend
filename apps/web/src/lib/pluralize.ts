import { formatCount } from './format-number';

/** "1 day", "1,234 devices" — for nouns that take a plain -s. */
export function pluralize(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;
}
