import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_NAME, APP_WORDMARK, ROLE_HOME, ROUTES } from '@/lib/constants';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { buttonClasses } from '@/components/ui/Button';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';

/**
 * Public navigation.
 *
 * `overlay` sits transparently on top of the gold hero, where the reference
 * shows only a small wordmark in the corner and nothing else competing with the
 * headline. `solid` is for every other public page, where a visible bar is
 * genuinely useful.
 *
 * Mobile is not a squeezed desktop bar: it collapses to the wordmark plus one
 * control, and the links move into a full-height sheet with room to tap.
 */

export interface NavbarProps {
  variant?: 'overlay' | 'solid';
}

export function Navbar({ variant = 'solid' }: NavbarProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the sheet on navigation, and never leave the body scroll-locked.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const links = [
    { to: ROUTES.public.standardsExplorer, label: t('nav.explore', 'Explore standards') },
    { to: ROUTES.public.services, label: t('nav.services', 'Services') },
    { to: ROUTES.public.howItWorks, label: t('nav.howItWorks', 'How it works') },
    { to: ROUTES.public.about, label: t('nav.about', 'About') },
  ];

  const onOverlay = variant === 'overlay';

  return (
    <header
      className={cn(
        'z-40 w-full',
        onOverlay
          ? 'absolute inset-x-0 top-0'
          : 'sticky top-0 border-b border-line bg-surface/90 backdrop-blur',
      )}
    >
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link
          to={ROUTES.public.home}
          className="group flex items-baseline gap-2.5"
          aria-label={`${APP_NAME} — ${t('nav.home', 'Home')}`}
        >
          <span
            className={cn(
              'font-devanagari text-h2 leading-none transition-opacity duration-300 group-hover:opacity-80',
              onOverlay ? 'text-invert' : 'text-ink',
            )}
          >
            {APP_WORDMARK}
          </span>
          <span
            className={cn(
              'hidden text-caption font-semibold uppercase tracking-[0.28em] sm:block',
              onOverlay ? 'text-invert/80' : 'text-ink-muted',
            )}
          >
            {APP_NAME}
          </span>
        </Link>

        {/* Desktop links are hidden on the hero, matching the reference's clean corner. */}
        <nav
          aria-label={t('nav.menu', 'Menu')}
          className={cn('hidden items-center gap-7', onOverlay ? 'lg:hidden' : 'lg:flex')}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'link-underline text-body transition-colors',
                  isActive ? 'font-medium text-primary' : 'text-ink hover:text-primary',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSelector tone={onOverlay ? 'onDark' : 'default'} className="hidden sm:block" />
          <ThemeToggle className={onOverlay ? 'text-invert' : undefined} />

          {isAuthenticated && user ? (
            <Link
              to={ROLE_HOME[user.role]}
              className={cn(
                'flex items-center gap-2.5 rounded-pill py-1 pl-1 pr-4 transition-colors',
                onOverlay ? 'bg-white/15 hover:bg-white/25' : 'bg-muted/60 hover:bg-muted',
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-caption font-semibold text-invert"
              >
                {initials(user.fullName)}
              </span>
              <span
                className={cn(
                  'text-label font-medium',
                  onOverlay ? 'text-invert' : 'text-ink',
                )}
              >
                {t('nav.dashboard', 'Dashboard')}
              </span>
            </Link>
          ) : (
            <>
              <Link
                to={ROUTES.auth.login}
                className={cn(
                  'hidden text-body transition-colors sm:block',
                  onOverlay ? 'text-invert hover:text-cream' : 'text-ink hover:text-primary',
                )}
              >
                {t('nav.signIn', 'Sign in')}
              </Link>
              <Link to={ROUTES.auth.register} className={buttonClasses('primary', 'sm')}>
                {t('nav.getStarted', 'Get started')}
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-pill lg:hidden',
              onOverlay ? 'text-invert hover:bg-white/15' : 'text-ink hover:bg-muted/60',
            )}
          >
            <span className="sr-only">{t('nav.menu', 'Menu')}</span>
            <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
              <path d="M0 1h20M0 7h20M0 13h14" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-devanagari text-h2 leading-none text-ink">{APP_WORDMARK}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-pill text-ink hover:bg-muted/60"
            >
              <span className="sr-only">{t('nav.closeMenu', 'Close menu')}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          </div>

          <nav aria-label={t('nav.menu', 'Menu')} className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-card px-4 py-3.5 text-body-lg transition-colors',
                        isActive ? 'bg-primary/10 font-medium text-primary' : 'text-ink hover:bg-muted/50',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-line pt-6">
              <LanguageSelector />
            </div>
          </nav>

          <div className="border-t border-line px-5 py-5">
            {isAuthenticated && user ? (
              <Link to={ROLE_HOME[user.role]} className={buttonClasses('primary', 'lg', 'w-full')}>
                {t('nav.dashboard', 'Dashboard')}
              </Link>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to={ROUTES.auth.register} className={buttonClasses('primary', 'lg', 'w-full')}>
                  {t('nav.getStarted', 'Get started')}
                </Link>
                <Link to={ROUTES.auth.login} className={buttonClasses('outline', 'lg', 'w-full')}>
                  {t('nav.signIn', 'Sign in')}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
