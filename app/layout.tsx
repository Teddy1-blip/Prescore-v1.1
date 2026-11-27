export const dynamic='force-dynamic';
import type { Metadata } from "next";
import "./globals.css";
import "./landing-ru.css";
import "./components/ui-v2/product-system.css";

export const metadata: Metadata = {
  title: "Прескор — скоринг и управление финансированием бизнеса",
  description: "Банковский поток, кредитный профиль, рекомендации и заявки на финансирование в одном кабинете.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg?v=prescore-mark-1",
    shortcut: "/favicon.svg?v=prescore-mark-1",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="prescore-v2">{children}</body>
    </html>
  );
}
