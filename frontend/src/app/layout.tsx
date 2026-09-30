import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../../public/assets/style.css";
import "../../public/assets/water.css";
import "../../public/assets/work-history.css";
import "../../public/assets/menu.css";
import "../../public/assets/pricing.css";
import "../../public/assets/admin.css";

export const metadata: Metadata = {
  title: {
    default: "terutaro",
    template: "%s — terutaro",
  },
  robots: { index: false, follow: false },
  icons: { icon: "data:," },
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
