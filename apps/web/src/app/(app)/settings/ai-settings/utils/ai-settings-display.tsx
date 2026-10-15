import type { IconRef } from '@flamingo-stack/openframe-frontend-core/components';
import type { AIProvider, AnswerStyle } from '../types/ai-settings';

export const LLM_PROVIDER_LABEL: Record<AIProvider, string> = {
  ANTHROPIC: 'Anthropic',
  OPENAI: 'OpenAI',
  GOOGLE_GEMINI: 'Google Gemini',
};

/** Each provider's mark, by name: drawn with `<NamedIcon>`, loaded when it is shown. */
export const LLM_PROVIDER_ICON: Record<AIProvider, IconRef> = {
  ANTHROPIC: { set: 'ClaudeIcon' },
  OPENAI: { set: 'OpenaiIcon' },
  GOOGLE_GEMINI: { set: 'GoogleGeminiIcon' },
};

export const LLM_PROVIDER_OPTIONS: AIProvider[] = ['ANTHROPIC', 'OPENAI', 'GOOGLE_GEMINI'];

export const ANSWER_STYLE_LABEL: Record<AnswerStyle, string> = {
  SHORT: 'Short',
  STANDARD: 'Standard',
  DETAILED: 'Detailed',
  CUSTOM: 'Custom',
};

export interface AnswerStyleOption {
  value: AnswerStyle;
  label: string;
  description: string;
}

export const ANSWER_STYLE_OPTIONS: AnswerStyleOption[] = [
  {
    value: 'SHORT',
    label: 'Short',
    description:
      'Quick, to-the-point responses that get straight to the answer. Minimal explanations and context. Best when you need fast answers without elaboration.',
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    description:
      'Balanced, conversational responses with clear explanations. Provides enough context to understand the answer without overwhelming detail. The recommended default for most interactions.',
  },
  {
    value: 'DETAILED',
    label: 'Detailed',
    description:
      'Comprehensive, in-depth answers with examples, context, and thorough exploration of topics. Includes background information, multiple perspectives, and practical applications.',
  },
  {
    value: 'CUSTOM',
    label: 'Custom',
    description:
      'Define your own AI behavior by editing the communication rules in master prompt. Customize tone, response format, expertise level, and communication style to match your specific needs.',
  },
];
