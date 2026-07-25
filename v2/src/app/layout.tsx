import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contador v2",
  description: "Бухгалтерский учёт для малого бизнеса Узбекистана",
  icons: {
    icon: [{ url: "/v2/contador icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
