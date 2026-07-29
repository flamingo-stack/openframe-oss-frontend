/**
 * Enter animation for content that SWAPS in place. A plain 200ms fade, nothing
 * else: the swap already changes what is on screen, so the animation only has
 * to soften the cut, not narrate it.
 *
 * Apply to a wrapper KEYED on whatever identifies the content
 * (`<div key={mode} className={CONTENT_SWAP_ANIMATION}>`): CSS animations run
 * on mount, so without a fresh key the swapped-in content just appears.
 *
 * **Not for tab bodies.** A tab switch renders in a transition, so the previous
 * tab holds the screen until the next one has its data; by the time the swap
 * commits the content is complete, and starting it at `opacity: 0` only delays
 * content that was ready and blanks the frame that had it. Motion for a tab
 * switch belongs on the tab bar's sliding indicator, not on the content. Reach
 * for this where the whole working surface changes and the switch is rare — the
 * device-selection mode radio, which is its one caller.
 *
 * What must never come back is a second, opposing opacity ramp above this one —
 * a wrapper dimming the outgoing content to `opacity-60` while the next half
 * loads. Two ramps in opposite directions over one swap read as a blink
 * (readable → dimmed → gone → fading up). One ramp, one direction.
 */
export const CONTENT_SWAP_ANIMATION = 'animate-in fade-in duration-200 motion-reduce:animate-none';
