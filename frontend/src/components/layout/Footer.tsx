import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_NAME, APP_WORDMARK, ROUTES } from '@/lib/constants';
import { PageContainer } from '@/components/layout/PageContainer';

/**
 * Footer.
 *
 * Carries the disclaimer prominently rather than burying it in 10px grey type.
 * MANAK is not the Bureau of Indian Standards, and a platform about standards
 * has no business being vague about its own provenance.
 */
export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const columns = [
    {
      heading: t('footer.product', 'Product'),
      links: [
        { label: t('nav.explore', 'Explore standards'), to: ROUTES.public.standardsExplorer },
        { label: t('nav.services', 'Services'), to: ROUTES.public.services },
        { label: t('nav.howItWorks', 'How it works'), to: ROUTES.public.howItWorks },
      ],
    },
    {
      heading: t('footer.company', 'Company'),
      links: [
        { label: t('nav.about', 'About'), to: ROUTES.public.about },
        { label: t('auth.login.createAccount', 'Create an account'), to: ROUTES.auth.register },
        { label: t('nav.signIn', 'Sign in'), to: ROUTES.auth.login },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-surface-sunken">
      <PageContainer space="md">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link to={ROUTES.public.home} className="inline-flex items-baseline gap-2.5">
              <span className="font-devanagari text-h2 leading-none text-ink">{APP_WORDMARK}</span>
              <span className="text-label font-semibold uppercase tracking-[0.28em] text-ink-muted">
                {APP_NAME}
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-body text-ink-muted">
              {t('footer.tagline', 'An independent knowledge platform for Indian standards.')}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="mb-3 text-caption font-semibold uppercase tracking-[0.18em] text-ink-muted">
                {column.heading}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="link-underline text-body text-ink transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 rounded-card border border-warning/40 bg-warning/10 p-4">
          <h2 className="text-label font-semibold text-ink">
            {t('footer.disclaimerTitle', 'Not an official BIS service')}
          </h2>
          <p className="mt-1 text-label text-ink-muted">
            {t(
              'footer.disclaimer',
              'MANAK indexes published standards information for reference. Always confirm compliance requirements against the official Bureau of Indian Standards record.',
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-caption text-ink-muted">
          <p>
            © {year} {APP_NAME}. {t('footer.rights', 'All rights reserved.')}
          </p>
          <p className="font-devanagari text-label">{APP_WORDMARK} · मानक ज्ञान मंच</p>
        </div>
      </PageContainer>
    </footer>
  );
}
