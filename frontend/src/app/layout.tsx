import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/portfolio";
import "../../public/assets/style.css";
import "../../public/assets/contact-corner.css";
import "../../public/assets/sidebar-rail.css";
import "../../public/assets/featured-works.css";
import "../../public/assets/skill-logos.css";
import "../../public/assets/water.css";
import "../../public/assets/work-history.css";
import "../../public/assets/menu.css";
import "../../public/assets/pricing.css";
import "../../public/assets/columns.css";
import "../../public/assets/admin.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/assets/icon.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/assets/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f5f1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
