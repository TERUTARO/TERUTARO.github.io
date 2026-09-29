import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("partners");
}

export default function PartnersPage() {
  return <PortfolioPage name="partners" />;
}
