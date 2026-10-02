import {
  getPortfolioPage,
  type PortfolioPageName,
  type PortfolioLocale,
  localeLanguages,
} from "@/lib/portfolio";

/**
 * Migration adapter for the existing, trusted Python-rendered markup.
 * Keep normal <a> document navigation while legacy scripts own this HTML island.
 * Do not pass user input or externally fetched HTML to this component.
 *
 * The page scripts are emitted as plain deferred <script> tags so they run as
 * soon as the static HTML has been parsed, instead of waiting for the React
 * bundle to download and hydrate (next/script "afterInteractive").
 */
export function PortfolioPage({ name, locale = 'ja' }: { name: PortfolioPageName; locale?: PortfolioLocale }) {
  const page = getPortfolioPage(name, locale);

  return (
    <>
      <div
        className={`page-${name}`}
        data-portfolio-page={name}
        data-locale={locale}
        lang={localeLanguages[locale]}
        dangerouslySetInnerHTML={{ __html: page.body }}
      />
      {page.scripts.map((src) => (
        <script key={src} src={src} defer />
      ))}
    </>
  );
}
