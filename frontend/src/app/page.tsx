import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("index");
}

export default function HomePage() {
  return <PortfolioPage name="index" />;
}
