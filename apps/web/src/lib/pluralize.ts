import { formatCount } from './format-number';

/** "1 day", "1,234 devices" — for nouns that take a plain -s. */
export function pluralize(count: number, noun: string): string {
  return `${formatCount(count)} ${pluralNoun(count, noun)}`;
}

/** The noun alone, for a count drawn apart from it: "policy" / "policies". */
export function pluralNoun(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
