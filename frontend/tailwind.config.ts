import type { Config } from 'tailwindcss';

/**
 * MANAK Tailwind theme.
 *
 * Colours resolve to the CSS custom properties declared in `src/index.css`, so
 * a single token edit re-themes the whole application and `[data-theme='dark']`
 * works without duplicating any class names. Components must use these semantic
 * names (`bg-surface`, `text-ink`) and never raw hex values.
 */

const rgb = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        background: rgb('--color-background'),
        surface: {
          DEFAULT: rgb('--color-surface'),
          raised: rgb('--color-surface-raised'),
          sunken: rgb('--color-surface-sunken'),
        },
        primary: {
          DEFAULT: rgb('--color-primary'),
          hover: rgb('--color-primary-hover'),
        },
        secondary: rgb('--color-secondary'),
        accent: rgb('--color-accent'),

        ink: rgb('--color-text'),
        'ink-muted': rgb('--color-text-muted'),
        'ink-fixed': rgb('--color-ink-fixed'),
        invert: rgb('--color-text-invert'),
        cream: rgb('--color-cream'),

        muted: rgb('--color-muted'),
        line: rgb('--color-border'),
        'line-strong': rgb('--color-border-strong'),

        success: rgb('--color-success'),
        warning: rgb('--color-warning'),
        error: rgb('--color-error'),
        ai: rgb('--color-ai'),
        info: rgb('--color-info'),

        // Raw palette escape hatches, for the hero/portal + auth motifs only.
        // Only add a name here if it is actually used as a Tailwind class. A
        // single-value entry like `stone: '...'` would SHADOW Tailwind's built-in
        // stone-100..900 scale, so `--manak-stone` / `--manak-clay` are consumed
        // directly as `rgb(var(--manak-clay))` inside the decorative SVGs instead.
        gold: {
          DEFAULT: rgb('--manak-gold'),
          deep: rgb('--manak-gold-deep'),
          dark: rgb('--manak-gold-dark'),
        },
        umber: rgb('--manak-umber'),
        arch: {
          1: rgb('--arch-1'),
          2: rgb('--arch-2'),
          3: rgb('--arch-3'),
          4: rgb('--arch-4'),
          5: rgb('--arch-5'),
        },
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
        geometric: ['Poppins', 'Inter', 'ui-sans-serif', 'sans-serif'],
        devanagari: ['"Tiro Devanagari Hindi"', '"Noto Serif Devanagari"', 'serif'],
      },

      /**
       * A real scale with intent. Hierarchy comes from the jumps between these
       * steps — the reference uses one enormous headline against small
       * supporting text, not uniformly large type.
       */
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1.1rem', letterSpacing: '0.02em' }],
        label: ['0.8125rem', { lineHeight: '1.15rem', letterSpacing: '0.01em' }],
        body: ['0.9375rem', { lineHeight: '1.6rem' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.75rem' }],
        h3: ['1.375rem', { lineHeight: '1.85rem' }],
        h2: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em' }],
        h1: ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.015em' }],
        display: ['4rem', { lineHeight: '4.15rem', letterSpacing: '-0.02em' }],
        // The full-bleed "STANDARDIZE" treatment.
        hero: ['clamp(2.75rem, 11vw, 9.5rem)', { lineHeight: '0.92', letterSpacing: '0.06em' }],
        wordmark: ['clamp(6rem, 26vw, 22rem)', { lineHeight: '0.78' }],
      },

      borderRadius: {
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        pill: 'var(--radius-pill)',
      },

      maxWidth: {
        shell: 'var(--shell-max)',
      },

      boxShadow: {
        card: '0 1px 2px rgb(35 31 32 / 0.06), 0 8px 24px -12px rgb(35 31 32 / 0.18)',
        raised: '0 2px 4px rgb(35 31 32 / 0.08), 0 18px 40px -18px rgb(35 31 32 / 0.28)',
        // Focus/selection glow using the violet accent from the reference grid.
        accent: '0 0 0 3px rgb(var(--color-accent) / 0.35)',
      },

      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        /* AI "thinking" — a calm breath, not a spinner. */
        'ai-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.92)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        /* Very slow ambient movement for hero/login background shapes. */
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(1.5%, -2%, 0) scale(1.04)' },
        },
      },

      animation: {
        // All of these hard-code the `premium` curve rather than reading a CSS
        // variable. Tailwind v4 exposes `--tw-ease` for this; v3.4 (what this
        // project pins) does not define it at all, so referencing it would just
        // silently fall through to the fallback on every single use.
        'fade-in': 'fade-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'ai-pulse': 'ai-pulse 1.4s ease-in-out infinite',
        drift: 'drift 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
