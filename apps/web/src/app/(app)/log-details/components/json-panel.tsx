'use client';

import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { formatJson, type JsonToken, tokenizeJson } from '../utils/json-highlight';

interface JsonPanelProps {
  /** Section title, also what the copy button and its toast call the payload ("Input", "Output"). */
  title: string;
  value: unknown;
}

// Property names and values take the two attention colours the design uses for
// them; punctuation stays the body colour so the structure reads as plain text.
const TOKEN_CLASS: Record<JsonToken['type'], string | undefined> = {
  key: 'text-ods-error',
  string: 'text-ods-success',
  scalar: 'text-ods-success',
  punct: undefined,
};

/**
 * One titled JSON card of the Log Details page, with a "Copy <title>" action
 * in its header. The payload is pretty-printed in full and wraps rather than
 * scrolls, so a long command output is never cut off; a string keeps its
 * escapes (`\n` stays `\n`), as the design shows it.
 */
export function JsonPanel({ title, value }: JsonPanelProps) {
  const json = formatJson(value);
  const { copy, copied } = useCopyToClipboard({
    successDescription: `${title} copied to clipboard`,
    errorDescription: `Unable to copy ${title.toLowerCase()}`,
  });

  return (
    <section className="flex w-full flex-col gap-3" aria-label={title}>
      <div className="flex items-center justify-between gap-[var(--spacing-system-xs)]">
        <h3 className="text-ods-text-secondary text-h5">{title}</h3>
        <Button
          variant="link"
          size="compact"
          onClick={() => copy(json)}
          leftIcon={copied ? <CheckIcon className="text-ods-success" /> : <Copy02Icon />}
        >
          Copy {title}
        </Button>
      </div>

      <div className="w-full rounded-[6px] border border-ods-border bg-ods-card">
        <div className="p-4 md:p-6">
          <pre className="min-w-0 whitespace-pre-wrap break-words text-ods-text-primary text-code">
            {tokenizeJson(json).map((token, i) =>
              token.type === 'punct' ? (
                token.text
              ) : (
                <span key={i} className={TOKEN_CLASS[token.type]}>
                  {token.text}
                </span>
              ),
            )}
          </pre>
        </div>
      </div>
    </section>
  );
}
