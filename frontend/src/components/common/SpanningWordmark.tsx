import { APP_WORDMARK } from '@/lib/constants';

/**
 * The cream मानक wordmark running continuously across two equal cards, with the
 * gutter appearing to slice through it. This is the reference dashboard's
 * signature device, reused on the landing page's audience pair.
 *
 * How it works, because it is not obvious:
 *
 * Each card clips its OWN copy of the wordmark, sized to span both cards plus
 * the gutter (`200% + gap`). The left card anchors its copy to its left edge and
 * the right card anchors its copy to its right edge, so both copies resolve to
 * the same absolute position on screen. The glyphs therefore line up across the
 * gap, and each card only reveals the portion of the word that falls inside it.
 *
 * A single element spanning the grid cannot achieve this. It would either sit
 * behind the opaque cards (invisible) or on top of them (painting over the
 * gutter and the card text). Two clipped copies is the trick.
 *
 * Requirements at the call site:
 *  - the card must be `relative` and `overflow-hidden` (it does the clipping)
 *  - card content must sit in a `relative` wrapper so it paints above this
 *  - `gap` must match the grid's real gutter, or the halves will misalign
 *
 * Desktop only. When the cards stack there is no gutter to cut, and a watermark
 * this large would simply crowd the text.
 */

export interface SpanningWordmarkProps {
  /** Which card of the pair this copy belongs to. */
  side: 'left' | 'right';
  /**
   * The grid gutter between the two cards, as a CSS length. Must match the
   * `gap-*` utility used by the parent grid.
   */
  gap?: string;
  /** Font size, as a CSS length. Use `clamp()` to keep it fluid. */
  size?: string;
  /**
   * Vertical offset. Negative values let the glyph descenders bleed off the
   * bottom edge of the card, as in the reference.
   */
  bottom?: string;
  /** 0–1. Defaults to the `.manak-wordmark--watermark` value. */
  opacity?: number;
}

export function SpanningWordmark({
  side,
  gap = '1.25rem',
  size = 'clamp(4rem, 17vw, 13rem)',
  bottom = '-0.14em',
  opacity,
}: SpanningWordmarkProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        'manak-wordmark manak-wordmark--watermark',
        'hidden text-center md:block',
        side === 'left' ? 'left-0' : 'right-0',
      ].join(' ')}
      /*
       * Inline styles rather than arbitrary Tailwind classes on purpose:
       * Tailwind's JIT scans source text, so `w-[calc(200%+${gap})]` built from
       * a prop would never be generated. These four values have to be dynamic
       * for the component to be reusable, so they cannot be classes.
       */
      style={{
        width: `calc(200% + ${gap})`,
        fontSize: size,
        bottom,
        ...(opacity === undefined ? {} : { opacity }),
      }}
    >
      {APP_WORDMARK}
    </span>
  );
}
