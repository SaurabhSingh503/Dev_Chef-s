import { cn } from '@/lib/utils';

/**
 * The hero portal.
 *
 * The reference centres a layered Mughal-style arch — concentric ogee arches
 * receding inward from orange through red, violet and blue to a near-navy
 * doorway — over vertical gold banding. It is the single strongest idea in the
 * design: a threshold you pass through, which is exactly what a standards
 * platform is. So it is drawn as real geometry rather than approximated with a
 * stock gradient blob.
 *
 * Purely decorative: `aria-hidden`, no pointer events, and the drift animation
 * is disabled under `prefers-reduced-motion` (see `styles/animations.css`).
 */

/** One ogee arch, sitting on `baseY`, centred on `cx`. */
function archPath(cx: number, baseY: number, width: number, height: number): string {
  const half = width / 2;
  const left = cx - half;
  const right = cx + half;
  const shoulder = baseY - height * 0.5;
  const tip = baseY - height;
  const cusp = height * 0.17;

  return [
    `M ${left} ${baseY}`,
    `L ${left} ${shoulder}`,
    `C ${left} ${shoulder - cusp * 1.7} ${cx - half * 0.55} ${tip + cusp * 1.95} ${cx} ${tip}`,
    `C ${cx + half * 0.55} ${tip + cusp * 1.95} ${right} ${shoulder - cusp * 1.7} ${right} ${shoulder}`,
    `L ${right} ${baseY}`,
    'Z',
  ].join(' ');
}

const CX = 500;
const BASE = 640;

/** Outermost → innermost. The two outer layers are the building; the rest is the portal. */
const LAYERS = [
  { width: 620, height: 560, fill: 'rgb(var(--manak-gold-dark))', opacity: 0.55 },
  { width: 500, height: 500, fill: 'rgb(var(--manak-terracotta))', opacity: 0.6 },
  { width: 392, height: 438, fill: 'rgb(var(--arch-1))', opacity: 0.95 },
  { width: 300, height: 378, fill: 'rgb(var(--arch-2))', opacity: 0.95 },
  { width: 224, height: 320, fill: 'rgb(var(--arch-3))', opacity: 0.95 },
  { width: 162, height: 268, fill: 'rgb(var(--arch-4))', opacity: 0.95 },
  { width: 112, height: 220, fill: 'rgb(var(--arch-5))', opacity: 1 },
];

export function HeroAnimation({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      {/* Vertical gold banding, as in the reference. */}
      <div className="manak-bands absolute inset-0" />

      <svg
        viewBox="0 0 1000 640"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
        role="presentation"
      >
        {/* Side towers, so the portal reads as architecture rather than a badge. */}
        <g opacity="0.32" fill="rgb(var(--manak-gold-dark))">
          <path d={archPath(196, BASE, 250, 330)} />
          <path d={archPath(804, BASE, 250, 330)} />
        </g>

        <g className="drift-slower origin-bottom">
          {LAYERS.map((layer) => (
            <path
              key={`${layer.width}-${layer.fill}`}
              d={archPath(CX, BASE, layer.width, layer.height)}
              fill={layer.fill}
              opacity={layer.opacity}
            />
          ))}
        </g>

        {/*
          Depth vignette. This is not decoration for its own sake: white text on
          bare gold (#D6B319) measures 2.0:1, which fails WCAG at any size. The
          headline stack sits in the lower half, so that half is composited with
          the innermost arch navy — 0.42 alpha at the top of the text band rising
          to 0.75 at the base. Measured white-on-result: 4.6:1 at the top of the
          band, 6.6:1 at the bottom. It also reinforces the receding portal, and
          the reference already dims its photographic screens for the same reason.
          If you lighten this, re-check the headline contrast.
        */}
        <defs>
          <linearGradient id="manak-hero-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--arch-5))" stopOpacity="0" />
            <stop offset="38%" stopColor="rgb(var(--arch-5))" stopOpacity="0.42" />
            <stop offset="100%" stopColor="rgb(var(--arch-5))" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <rect x="0" y="248" width="1000" height="392" fill="url(#manak-hero-vignette)" />
      </svg>
    </div>
  );
}
