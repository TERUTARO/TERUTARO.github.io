import Script from "next/script";
import {
  getPortfolioPage,
  type PortfolioPageName,
} from "@/lib/portfolio";

/**
 * Migration adapter for the existing, trusted Python-rendered markup.
 * Keep normal <a> document navigation while legacy scripts own this HTML island.
 * Do not pass user input or externally fetched HTML to this component.
 */
export function PortfolioPage({ name }: { name: PortfolioPageName }) {
  const page = getPortfolioPage(name);

  return (
    <>
      <div
        className={`page-${name}`}
        data-portfolio-page={name}
        dangerouslySetInnerHTML={{ __html: page.body }}
      />
      {page.scripts.map((src, index) => (
        <Script
          key={src}
          id={`portfolio-${name}-${index}`}
          src={src}
          strategy="afterInteractive"
        />
      ))}
    </>
  );
}
