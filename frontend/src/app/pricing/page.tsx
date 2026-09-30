import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("pricing");
}

export default function PricingPage() {
  return <PortfolioPage name="pricing" />;
}
