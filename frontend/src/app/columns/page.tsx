import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("columns");
}

export default function ColumnsPage() {
  return <PortfolioPage name="columns" />;
}
