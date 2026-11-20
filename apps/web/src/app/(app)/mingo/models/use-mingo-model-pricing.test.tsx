import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useMingoModelPricing } from './use-mingo-model-pricing';

vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('@/app/hooks/use-non-suspending-query', () => ({
  useNonSuspendingQuery: () => ({
    data: {
      aiModelRates: [
        { providerType: 'ANTHROPIC', modelName: 'example', inputTokenRate: 1.333, outputTokenRate: 6.667 },
        { providerType: 'OPENAI', modelName: 'example', inputTokenRate: 0.3, outputTokenRate: 1.5 },
      ],
    },
  }),
}));

it('quotes model rates by provider and exact model ID', () => {
  const root = createRoot(document.createElement('div'));
  const observed = vi.fn();

  function Probe() {
    const pricing = useMingoModelPricing(true);
    useEffect(() => {
      observed(pricing.rateFor('OPENAI', 'example'), pricing.rateFor('OPENAI', 'missing'));
    }, [pricing]);
    return null;
  }

  try {
    act(() => root.render(<Probe />));
    expect(observed).toHaveBeenCalledWith({ input: 0.3, output: 1.5 }, undefined);
  } finally {
    act(() => root.unmount());
  }
});
