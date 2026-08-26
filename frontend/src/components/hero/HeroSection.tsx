import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_NAME, ROUTES } from '@/lib/constants';
import { buttonClasses } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';
import { HeroAnimation } from '@/components/hero/HeroAnimation';

/**
 * The landing hero, following the reference composition exactly:
 *
 *   tiny wordmark, top-left corner (nothing else competing with it)
 *   layered arch portal, centred, upper two-thirds
 *   ONE enormous wide-tracked headline, full-bleed edge to edge
 *   the second line in bold lowercase, much smaller, centred
 *   a short subtitle, smaller again
 *   a single orange pill call to action
 *   an emblem in the bottom-right corner
 *
 * The whole point is one gigantic piece of type against small quiet type. No
 * feature grid, no three columns of cards, no floating browser mockup.
 *
 * The headline is rendered as SVG text with `textLength` so it spans the
 * viewport precisely regardless of which font actually loads and regardless of
 * how long the translated word is — Hindi's "मानकीकृत करें" and English's
 * "STANDARDIZE" both stretch to the same measure. `lengthAdjust="spacing"`
 * adjusts tracking rather than distorting glyph shapes.
 */

/**
 * Neutral MANAK emblem. Deliberately NOT the BIS logo: that is a government
 * trademark, MANAK is an independent platform, and the footer says so plainly.
 * Reproducing it here would contradict our own disclaimer.
 */
function Emblem() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-6 right-5 hidden items-center gap-2.5 sm:flex sm:right-8"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/45">
        <span className="font-devanagari text-body-lg leading-none text-white/80">मा</span>
      </span>
      <span className="text-caption font-semibold uppercase tracking-[0.22em] text-white/60">
        {APP_NAME}
      </span>
    </span>
  );
}

export function HeroSection() {
  const { t } = useTranslation();

  const headline = t('home.headline', 'STANDARDIZE');
  const headlineTail = t('home.headlineTail', 'your product.');

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-background">
      <HeroAnimation />

      <Navbar variant="overlay" />

      {/* mt-auto pushes the stack down over the base of the portal, as in the reference. */}
      <div className="relative z-10 mt-auto w-full pb-16 pt-24 sm:pb-20">
        <p className="mb-5 px-5 text-center text-caption font-semibold uppercase tracking-[0.3em] text-white sm:text-label">
          {t('home.eyebrow', 'Bureau of Indian Standards knowledge platform')}
        </p>

        <h1 className="mb-3">
          {/* One accessible heading; the two visual layers below are decorative. */}
          <span className="sr-only">{`${headline} ${headlineTail}`}</span>

          <span aria-hidden="true" className="block px-3 sm:px-5">
            <svg
              viewBox="0 0 1000 148"
              preserveAspectRatio="xMidYMid meet"
              className="block w-full text-white"
              focusable="false"
              role="presentation"
            >
              <text
                x="500"
                y="116"
                textAnchor="middle"
                textLength="982"
                lengthAdjust="spacing"
                fill="currentColor"
                className="font-geometric"
                style={{ fontSize: '128px', fontWeight: 700 }}
              >
                {headline}
              </text>
            </svg>
          </span>

          <span
            aria-hidden="true"
            className="block px-5 text-center text-[clamp(1.5rem,5vw,3.5rem)] font-bold lowercase leading-[1.05] tracking-tight text-white"
          >
            {headlineTail}
          </span>
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-balance px-5 text-center text-body text-white/85 sm:text-body-lg">
          {t(
            'home.subheadline',
            'Every Indian standard, certification route and testing requirement — explained plainly, answered from the source.',
          )}
        </p>

        <div className="flex justify-center px-5">
          <Link
            to={ROUTES.public.standardsExplorer}
            className={buttonClasses('primary', 'lg', 'min-w-[13rem]')}
          >
            {t('home.heroCta', 'Explore standards')}
          </Link>
        </div>
      </div>

      <Emblem />
    </section>
  );
}
