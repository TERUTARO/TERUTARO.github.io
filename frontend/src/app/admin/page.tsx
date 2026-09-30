import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";

export const metadata: Metadata = {
  title: "管理画面",
  description: "terutaroのコンテンツとお問い合わせを管理する画面です。",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminConsole />;
}
