import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/lib/constants';
import { HeroSection } from '@/components/hero/HeroSection';
import { Footer } from '@/components/layout/Footer';
import { PageContainer, SectionHeading } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { SpanningWordmark } from '@/components/common/SpanningWordmark';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { buttonClasses } from '@/components/ui/Button';

/**
 * Landing page.
 *
 * Follows the reference's storytelling order: one overwhelming hero, then search
 * as a first-class object, then a quiet trust band, then what the product does,
 * then who it is for, then a single closing ask.
 *
 * The two audience cards reproduce the reference dashboard's signature device —
 * the cream मानक wordmark running continuously across both cards with the gutter
 * cutting through it. See `SpanningWordmark` for how that is achieved.
 */

const EXAMPLE_QUERIES = ['IS 456', 'Drinking water', 'Gold hallmarking', 'Helmets'];

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    navigate(
      trimmed
        ? `${ROUTES.public.standardsExplorer}?q=${encodeURIComponent(trimmed)}`
        : ROUTES.public.standardsExplorer,
    );
  };

  const pillars = [
    {
      key: 'standards',
      title: t('home.pillars.standards.title', 'Find the standard that applies'),
      body: t(
        'home.pillars.standards.body',
        'Search by product, sector or standard number and see scope, status and revision history at a glance.',
      ),
      to: ROUTES.public.standardsExplorer,
    },
    {
      key: 'certification',
      title: t('home.pillars.certification.title', 'Understand the certification route'),
      body: t(
        'home.pillars.certification.body',
        'ISI mark, hallmarking, registration schemes — the steps, documents and costs, in order.',
      ),
      to: ROUTES.public.services,
    },
    {
      key: 'testing',
      title: t('home.pillars.testing.title', 'Locate a recognised laboratory'),
      body: t(
        'home.pillars.testing.body',
        'Search BIS-recognised testing facilities by pincode, sector and the test you actually need.',
      ),
      to: ROUTES.public.services,
    },
    {
      key: 'ai',
      title: t('home.pillars.ai.title', 'Ask, and get a cited answer'),
      body: t(
        'home.pillars.ai.body',
        'The assistant answers only from indexed standards and shows its sources. When the source is not there, it says so.',
      ),
      to: ROUTES.public.howItWorks,
    },
  ];

  const trust = [
    t(
      'home.trust.grounded',
      'Every AI answer is generated only from indexed standards, and shows the sources it used.',
    ),
    t('home.trust.languages', 'Available in eight Indian languages, including Hindi and Tamil.'),
    t(
      'home.trust.independent',
      'Independent of the Bureau of Indian Standards — always confirm against the official record.',
    ),
  ];

  return (
    <>
      <main id="main">
        <HeroSection />

        {/* Search as a first-class object, not a utility in a corner. */}
        <section className="bg-background">
          <PageContainer width="default" space="lg">
            <h2 className="mb-6 text-center font-display text-h2 text-ink">
              {t('home.searchLabel', 'Search Indian standards')}
            </h2>

            <SearchBar
              variant="hero"
              label={t('home.searchLabel', 'Search Indian standards')}
              placeholder={t(
                'home.searchPlaceholder',
                'Search a standard, product or certification',
              )}
              value={query}
              onChange={setQuery}
              onSubmit={runSearch}
              submitLabel={t('home.searchCta', 'Search')}
              footer={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-label text-ink-muted">
                    {t('home.trySearches', 'Try')}
                  </span>
                  {EXAMPLE_QUERIES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setQuery(example);
                        runSearch(example);
                      }}
                      className="rounded-pill border border-ink/45 px-3 py-1 text-label text-ink transition-colors duration-300 hover:border-ink hover:bg-ink/5"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              }
            />
          </PageContainer>
        </section>

        {/* Quiet trust band. Deliberately three sentences, no invented metrics. */}
        <section className="bg-background pb-4">
          <PageContainer width="default" space="none">
            <div className="manak-rule" aria-hidden="true" />
            <ul className="grid gap-6 py-10 sm:grid-cols-3">
              {trust.map((line) => (
                <li key={line} className="text-body text-ink-muted">
                  {line}
                </li>
              ))}
            </ul>
            <div className="manak-rule" aria-hidden="true" />
          </PageContainer>
        </section>

        {/* What it does. */}
        <section className="bg-background">
          <PageContainer width="default" space="lg">
            <SectionHeading
              eyebrow={t('home.eyebrow', 'Bureau of Indian Standards knowledge platform')}
              title={t('home.pillars.title', 'What MANAK does')}
            />

            <ul className="grid gap-5 md:grid-cols-2">
              {pillars.map((pillar, index) => (
                <li key={pillar.key}>
                  <Link to={pillar.to} className="group block h-full focus:outline-none">
                    <Card
                      variant="card"
                      className="h-full group-hover:-translate-y-0.5 group-hover:shadow-raised group-focus-visible:shadow-raised"
                    >
                      <CardTitle eyebrow={String(index + 1).padStart(2, '0')} as="h3">
                        {pillar.title}
                      </CardTitle>
                      <CardBody className="mt-2">{pillar.body}</CardBody>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </PageContainer>
        </section>

        {/* Who it is for — the reference's two equal cards with the spanning wordmark. */}
        <section className="bg-background">
          <PageContainer width="default" space="lg">
            <SectionHeading title={t('home.audience.title', 'Built for both sides of a standard')} />

            <div className="grid gap-5 md:grid-cols-2">
              <Card variant="panel" padded={false} className="overflow-hidden">
                <SpanningWordmark side="left" />
                <div className="relative z-10 flex h-full min-h-[17rem] flex-col p-6 sm:p-8">
                  <h3 className="font-display text-h2 text-ink">
                    {t('home.audience.organization.title', 'For manufacturers and organisations')}
                  </h3>
                  <p className="mt-3 max-w-md text-body text-ink/85">
                    {t(
                      'home.audience.organization.body',
                      'Track the standards that apply to your products, follow certification progress, and generate compliance handbooks for your team.',
                    )}
                  </p>
                  <div className="mt-auto pt-7">
                    <Link
                      to={ROUTES.auth.registerOrganization}
                      className={buttonClasses('secondary', 'md')}
                    >
                      {t('home.audience.organization.cta', 'Register an organisation')}
                    </Link>
                  </div>
                </div>
              </Card>

              <Card variant="panel" padded={false} className="overflow-hidden">
                <SpanningWordmark side="right" />
                <div className="relative z-10 flex h-full min-h-[17rem] flex-col p-6 sm:p-8">
                  <h3 className="font-display text-h2 text-ink">
                    {t('home.audience.individual.title', 'For consumers and professionals')}
                  </h3>
                  <p className="mt-3 max-w-md text-body text-ink/85">
                    {t(
                      'home.audience.individual.body',
                      'Check whether a product is certified, understand hallmarking, and learn what a standard actually guarantees.',
                    )}
                  </p>
                  <div className="mt-auto pt-7">
                    <Link
                      to={ROUTES.auth.registerIndividual}
                      className={buttonClasses('secondary', 'md')}
                    >
                      {t('home.audience.individual.cta', 'Create a free account')}
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </PageContainer>
        </section>

        {/* One closing ask. */}
        <section className="bg-background">
          <PageContainer width="narrow" space="lg" className="text-center">
            <h2 className="font-display text-h1 text-ink">
              {t('home.closing.title', 'Standards should not be hard to read')}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-body-lg text-ink-muted">
              {t(
                'home.closing.body',
                'MANAK indexes the published record and answers from it — with citations, in your language.',
              )}
            </p>
            <Link
              to={ROUTES.public.standardsExplorer}
              className={buttonClasses('primary', 'lg', 'mt-8 min-w-[13rem]')}
            >
              {t('home.closing.cta', 'Start exploring')}
            </Link>
          </PageContainer>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default Home;
