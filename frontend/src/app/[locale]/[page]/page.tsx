import { notFound } from 'next/navigation';
import { PortfolioPage } from '@/components/portfolio-page';
import { getPortfolioMetadata, portfolioPageNames, type PortfolioLocale, type PortfolioPageName } from '@/lib/portfolio';

type RouteParams = { locale: string; page: string };
export const dynamicParams = false;

export function generateStaticParams() {
  return ['en', 'zh'].flatMap(locale => portfolioPageNames.map(page => ({locale, page})));
}

async function readParams(params: Promise<RouteParams>) {
  const {locale, page} = await params;
  if (!['en', 'zh'].includes(locale) || !portfolioPageNames.includes(page as PortfolioPageName)) notFound();
  return {locale: locale as PortfolioLocale, page: page as PortfolioPageName};
}

export async function generateMetadata({params}: {params: Promise<RouteParams>}) {
  const {locale, page} = await readParams(params);
  return getPortfolioMetadata(page, locale);
}

export default async function LocalizedPage({params}: {params: Promise<RouteParams>}) {
  const {locale, page} = await readParams(params);
  return <PortfolioPage name={page} locale={locale} />;
}
