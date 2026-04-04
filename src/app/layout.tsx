import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ClientLayout } from "@/components/Layout/ClientLayout";

export const metadata: Metadata = {
  title: "CONTADOR | Accounting",
  description: "IT Service Company Financial Management",
  icons: {
    icon: "/contador icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased font-sans">
        <Providers>
          <ClientLayout>
            {children}
          </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
