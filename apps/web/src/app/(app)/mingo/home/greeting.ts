/** The part of the day a greeting names, by the local hour (0-23). */
export type DayPart = 'Morning' | 'Afternoon' | 'Evening';

export function dayPartOf(hour: number): DayPart {
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

/**
 * Mingo's home greeting: "Morning, Ann" by the local hour. Without a first name it greets
 * nobody in particular ("Good morning") rather than a fallback that reads like a name (an
 * email's local part, "there").
 */
export function greetingFor(hour: number, firstName: string | null | undefined): string {
  const part = dayPartOf(hour);
  const name = firstName?.trim();
  return name ? `${part}, ${name}` : `Good ${part.toLowerCase()}`;
}
