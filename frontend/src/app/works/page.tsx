import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("works");
}

export default function WorksPage() {
  return <PortfolioPage name="works" />;
}
