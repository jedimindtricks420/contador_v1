import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/manifest";
import { SITE_ORIGIN } from "@/lib/site";
import "../globals.css";

// Корневой layout маркетингового приложения — под динамическим сегментом
// [locale], как рекомендует официальный i18n-гайд Next.js для App Router
// (node_modules/next/dist/docs/01-app/02-guides/internationalization.md:
// "The root layout can be under a dynamic segment ... app/[lang]/layout.js").
// Отдельного app/layout.tsx НЕТ и не должно быть — единственный <html> на
// всё приложение объявляется здесь, второй раз его нигде вкладывать нельзя.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
};

function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
