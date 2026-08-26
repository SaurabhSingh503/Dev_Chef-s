import { cn } from '@/lib/utils';

/**
 * Backdrop for the auth screens.
 *
 * The reference login is not a centred card on a flat page — it is a full-bleed
 * organic composition: soft terracotta/taupe blobs bleeding off every edge,
 * thin botanical line art, and a few small starbursts. That is what stops the
 * screen looking like a Bootstrap login form, so it is built properly here
 * rather than replaced with a gradient.
 *
 * Entirely decorative: `aria-hidden`, no pointer events.
 */

/** A single tapered four-point starburst. */
function Starburst({
  x,
  y,
  size,
  opacity,
}: {
  x: number;
  y: number;
  size: number;
  opacity: number;
}) {
  const long = size;
  const short = size * 0.26;
  return (
    <path
      d={[
        `M ${x} ${y - long}`,
        `Q ${x + short * 0.5} ${y - short * 0.5} ${x + long} ${y}`,
        `Q ${x + short * 0.5} ${y + short * 0.5} ${x} ${y + long}`,
        `Q ${x - short * 0.5} ${y + short * 0.5} ${x - long} ${y}`,
        `Q ${x - short * 0.5} ${y - short * 0.5} ${x} ${y - long}`,
        'Z',
      ].join(' ')}
      fill="rgb(var(--color-cream))"
      opacity={opacity}
    />
  );
}

/**
 * A stem with leaves. `flip` mirrors it so the two instances do not read as a
 * copy-paste, and the whole group is positioned by the caller's transform.
 */
function Botanical({ transform, flip = false }: { transform: string; flip?: boolean }) {
  return (
    <g
      transform={transform}
      fill="none"
      stroke="rgb(var(--color-cream))"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.5"
    >
      <g transform={flip ? 'scale(-1, 1)' : undefined}>
        <path d="M0 0 C 14 -48 22 -104 16 -168" />
        {[
          { y: -30, s: 1 },
          { y: -66, s: 0.92 },
          { y: -102, s: 0.8 },
          { y: -134, s: 0.62 },
        ].map((leaf) => (
          <g key={leaf.y} transform={`translate(${8 + leaf.y * -0.09} ${leaf.y}) scale(${leaf.s})`}>
            <path d="M0 0 C 20 -12 40 -6 48 10 C 28 18 8 12 0 0 Z" />
            <path d="M2 1 C 18 2 34 6 46 9" strokeWidth="1" />
            <path d="M0 0 C -20 -12 -40 -6 -48 10 C -28 18 -8 12 0 0 Z" />
            <path d="M-2 1 C -18 2 -34 6 -46 9" strokeWidth="1" />
          </g>
        ))}
      </g>
    </g>
  );
}

export function AuthBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="presentation"
      >
        <defs>
          {/* Soft edges: the reference blobs have no hard outline. */}
          <filter id="manak-auth-soften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
          <radialGradient id="manak-auth-glow" cx="0.5" cy="0.35" r="0.7">
            <stop offset="0%" stopColor="rgb(var(--manak-clay))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(var(--manak-clay))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Organic blobs, each bleeding off an edge so nothing reads as a card. */}
        <g filter="url(#manak-auth-soften)">
          <path
            d="M-140 -80 C 160 -170 430 -40 400 130 C 372 292 150 330 -30 268 C -190 214 -300 40 -140 -80 Z"
            fill="rgb(var(--manak-clay))"
            opacity="0.62"
          />
          <path
            d="M1290 60 C 1180 210 960 200 900 330 C 846 448 980 560 1130 540 C 1270 522 1340 340 1330 190 Z"
            fill="rgb(var(--manak-stone))"
            opacity="0.5"
          />
          <path
            d="M300 880 C 250 720 430 640 620 660 C 830 682 900 800 860 900 Z"
            fill="rgb(var(--manak-clay))"
            opacity="0.5"
          />
          <path
            d="M540 -120 C 700 -150 830 -40 800 90 C 772 208 620 220 540 150 C 470 88 450 -96 540 -120 Z"
            fill="rgb(var(--manak-stone))"
            opacity="0.32"
          />
        </g>

        <rect x="0" y="0" width="1200" height="800" fill="url(#manak-auth-glow)" />

        <Botanical transform="translate(120 790)" />
        <Botanical transform="translate(1090 800) scale(1.15)" flip />
        <Botanical transform="translate(980 250) scale(0.62) rotate(14)" />

        <Starburst x={228} y={168} size={19} opacity={0.85} />
        <Starburst x={318} y={112} size={10} opacity={0.6} />
        <Starburst x={1006} y={604} size={16} opacity={0.75} />
        <Starburst x={922} y={666} size={9} opacity={0.5} />
        <Starburst x={664} y={82} size={12} opacity={0.55} />
      </svg>
    </div>
  );
}
