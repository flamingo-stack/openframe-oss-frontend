'use client';

import { MinusCircleIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef } from 'react';

interface QuantityStepperProps {
  /** The committed quantity. Written into the field only when it changes from OUTSIDE it. */
  value: number;
  /** Floor for the buttons and the arrow keys; typing below it is left to `error`/`onCommit`. */
  min: number;
  /** Granularity of a single step. */
  step?: number;
  /** Accessible name for the number field. */
  label: string;
  /** Message shown under the field; also turns the group's border red. */
  error?: string;
  /** A quantity the user typed or stepped to. May be out of range — `onCommit` settles it. */
  onChange: (next: number) => void;
  /** Editing finished (blur or Enter): the owner clamps whatever was typed. */
  onCommit: () => void;
  className?: string;
}

/** Everything the user can type that is not a digit. */
const NON_DIGIT = /\D/;

/**
 * Number field with − / + controls.
 *
 * The field is UNCONTROLLED, and that is the point of this component. A
 * controlled numeric input — `value={String(number)}` fed by a parsed
 * `onChange` — rewrites the text on every keystroke, and the rewrite is not
 * neutral: clearing the field to type a new number snaps it back, a leading "0"
 * vanishes as you type it, and any correction mid-string throws the caret to the
 * end. The DOM node owns the text being edited; React owns the number.
 *
 * The two are reconciled in one direction only: when `value` changes for a
 * reason other than typing (the buttons, a clamp, fresh data), it is written
 * into the node. A parse check guards that write, so a `value` that already
 * matches what is on screen never touches the node — which is what keeps the
 * caret where the user put it.
 *
 * `type="text"` with `inputMode="numeric"`, not `type="number"`: the native
 * number input changes value on the scroll wheel, ships browser spinners that
 * cannot be styled to this design, and reports an empty string for anything it
 * considers invalid — which hides what the user actually typed.
 */
export function QuantityStepper({
  value,
  min,
  step = 1,
  label,
  error,
  onChange,
  onCommit,
  className,
}: QuantityStepperProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    const node = inputRef.current;
    // Already showing this number — including when the user just typed it — so
    // leave the text (and the caret) exactly as it is.
    if (!node || Number.parseInt(node.value, 10) === value) return;
    node.value = String(value);
  }, [value]);

  const stepBy = (delta: number) => onChange(Math.max(min, value + delta * step));

  // Reject non-digits before they reach the DOM, so nothing has to be rewritten
  // (and no caret has to be restored) after the fact.
  const handleBeforeInput = (event: FormEvent<HTMLInputElement>) => {
    const { data } = event.nativeEvent as InputEvent;
    if (data != null && NON_DIGIT.test(data)) event.preventDefault();
  };

  const handleChange = (event: FormEvent<HTMLInputElement>) => {
    const node = event.currentTarget;
    // Backstop for input `beforeinput` cannot cancel (IME commits, some Android
    // keyboards). Rare enough that landing the caret at the end is fine.
    if (NON_DIGIT.test(node.value)) node.value = node.value.replace(/\D/g, '');
    const parsed = Number.parseInt(node.value, 10);
    // An empty field is a state to type in, not a quantity: reporting 0 here
    // would move `value`, and the effect above would then refill the field the
    // user just cleared.
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      stepBy(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onCommit();
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {/* The GROUP owns the border, the focus ring and the invalid state; the
          field inside is stripped of its own. `Input` paints its focus colour on
          all four edges, and inside a joined group only one of them has width —
          which drew a stray coloured bar down a single seam. The seams are the
          buttons' borders instead, one per boundary, so they cannot double up. */}
      <div
        className={cn(
          'flex shrink-0 items-center overflow-hidden rounded-md border bg-ods-card transition-colors',
          error ? 'border-ods-error' : 'border-ods-border focus-within:border-ods-accent',
          className,
        )}
      >
        <Button
          variant="transparent"
          size="icon"
          aria-label={`Decrease ${label}`}
          className="rounded-none border-r border-ods-border"
          disabled={value <= min}
          onClick={() => stepBy(-1)}
        >
          <MinusCircleIcon />
        </Button>
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          aria-label={label}
          aria-invalid={error != null}
          aria-describedby={error ? errorId : undefined}
          defaultValue={String(value)}
          onFocus={event => event.currentTarget.select()}
          onBeforeInput={handleBeforeInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onCommit}
          className="w-[86px] rounded-none border-0 bg-transparent px-0 hover:bg-transparent active:bg-transparent [&_input]:text-center"
        />
        <Button
          variant="transparent"
          size="icon"
          aria-label={`Increase ${label}`}
          className="rounded-none border-l border-ods-border"
          onClick={() => stepBy(1)}
        >
          <PlusCircleIcon />
        </Button>
      </div>
      {error && (
        <p id={errorId} className="text-h6 text-ods-error">
          {error}
        </p>
      )}
    </div>
  );
}
