import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("events");
}

export default function EventsPage() {
  return <PortfolioPage name="events" />;
}
