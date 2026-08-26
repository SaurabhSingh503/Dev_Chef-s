import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { UserRole } from '@shared/types';

import { APP_NAME, APP_WORDMARK, ROUTES } from '@/lib/constants';
import { NAVIGATION, isNavItemActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icons/Icon';

/**
 * Authenticated navigation rail.
 *
 * Deliberately NOT used on the dashboard itself. The reference dashboard is a
 * portal — two enormous doors and nothing else — and bolting a permanent rail
 * onto it would produce precisely the generic admin-template look the brief
 * rules out. `DashboardLayout` renders this only in `workspace` chrome, for the
 * inner pages that genuinely need to move between many sections.
 *
 * Visually it is a deep umber panel rather than the usual white/grey rail: umber
 * is already the login screen's ground, it reads as a distinct architectural
 * element against the gold canvas, and cream-on-umber measures 8.9:1.
 *
 * On `lg` and up it is a static column. Below that it is an overlay drawer with
 * focus containment and Escape-to-close, driven by `open`/`onClose`.
 */

export interface SidebarProps {
  role: UserRole;
  /** Drawer state. Ignored at `lg` and above, where the rail is always present. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const groups = NAVIGATION[role];

  // Route changes must dismiss the drawer, or tapping a link on a phone leaves
  // the panel covering the page you just navigated to.
  useEffect(() => {
    if (open) onClose();
    // Intentionally keyed on pathname only: including `open`/`onClose` would
    // close the drawer the instant it opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Focus containment: while the drawer covers the page, Tab must not reach
      // the content behind it.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Scrim, below lg only. Clicking it closes the drawer. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-black/45 transition-opacity duration-300 ease-premium lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <div
        ref={panelRef}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col bg-umber',
          'transition-transform duration-300 ease-premium',
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-6">
          <Link
            to={ROUTES.public.home}
            className="flex items-baseline gap-2.5 focus-visible:outline-none"
          >
            <span className="manak-wordmark text-[1.75rem] leading-none">{APP_WORDMARK}</span>
            <span className="text-label font-semibold uppercase tracking-[0.22em] text-cream/80">
              {APP_NAME}
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-pill p-2 text-cream/85 transition-colors hover:bg-white/10 hover:text-cream lg:hidden"
          >
            <Icon name="close" size={18} title={t('common.close', 'Close')} />
          </button>
        </div>

        <nav aria-label={t('nav.menu', 'Menu')} className="flex-1 overflow-y-auto px-3 pb-6">
          {groups.map((group, index) => (
            <div
              key={group.labelKey ?? `group-${index}`}
              className={cn(index > 0 && 'mt-6 border-t border-white/12 pt-5')}
            >
              {group.labelKey ? (
                <p className="mb-2 px-3 text-caption font-semibold uppercase tracking-[0.18em] text-cream/60">
                  {t(group.labelKey, group.fallback ?? '')}
                </p>
              ) : null}

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavItemActive(item, pathname);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-input px-3 py-2.5 text-body',
                          'transition-colors duration-200 ease-premium',
                          active
                            ? 'bg-cream/95 font-medium text-ink-fixed'
                            : 'text-cream/85 hover:bg-white/10 hover:text-cream',
                        )}
                      >
                        <Icon name={item.icon} size={18} />
                        <span className="truncate">{t(item.labelKey, item.fallback)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
