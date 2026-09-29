import { PortfolioPage } from "@/components/portfolio-page";
import { getPortfolioMetadata } from "@/lib/portfolio";

export function generateMetadata() {
  return getPortfolioMetadata("contact");
}

export default function ContactPage() {
  return <PortfolioPage name="contact" />;
}
