import { describe, expect, it } from 'vitest';
import { TOUR_DEVICE_FALLBACK, TOUR_STEPS, type TourAction, tourPrompt } from './tour-steps';

const action = (id: string): TourAction => {
  const found = TOUR_STEPS.flatMap(step => step.actions).find(a => a.id === id);
  if (!found) throw new Error(`no tour action ${id}`);
  return found;
};

describe('tourPrompt', () => {
  it('names the first device by its mention, the token the composer commits', () => {
    expect(tourPrompt(action('check-device'), { mentionId: 'm-1' })).toBe(
      'Check @device:m-1: OS, uptime, CPU, memory and free disk. Tell me if anything needs attention.',
    );
    expect(tourPrompt(action('incidents-on-device'), { mentionId: 'm-1' })).toBe(
      'Are there open incidents on @device:m-1? Show severity and what you saw.',
    );
  });

  it('falls back to "my device" without a device to name', () => {
    expect(tourPrompt(action('check-device'), null)).toContain(`Check ${TOUR_DEVICE_FALLBACK}:`);
    expect(tourPrompt(action('errors-since-install'), { mentionId: null })).toBe(
      `Show any errors or warnings the agent logged on ${TOUR_DEVICE_FALLBACK} since it was installed.`,
    );
  });

  it('sends a prompt that is not about the device as written', () => {
    expect(tourPrompt(action('critical-first'), { mentionId: 'm-1' })).toBe(
      'Show all open incidents, critical and high first, and who owns them.',
    );
    expect(tourPrompt(action('kb-folders'), null)).not.toContain('@device');
  });

  it('keeps every mention a token the message renderer recognises', () => {
    const mention = /(^|[^\w@])@device:[A-Za-z0-9_.+/=-]*[A-Za-z0-9_+/=](?![\w])/;
    for (const step of TOUR_STEPS) {
      for (const a of step.actions) {
        if (typeof a.prompt === 'string') continue;
        expect(tourPrompt(a, { mentionId: 'abc123' })).toMatch(mention);
      }
    }
  });
});
