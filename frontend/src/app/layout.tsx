import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kawayan Atlas — Bamboo structures, learned and designed",
    template: "%s · Kawayan Atlas",
  },
  description:
    "A Philippine reference and design sandbox for bamboo construction: species atlas, joint library, templates, and a design studio.",
  keywords: [
    "bamboo",
    "kawayan",
    "Philippines",
    "bamboo construction",
    "bahay kubo",
    "bamboo structures",
  ],
  openGraph: {
    title: "Kawayan Atlas",
    description:
      "Learn, design, and sanity-check bamboo structures for the Philippines.",
    type: "website",
    locale: "en_PH",
    siteName: "Kawayan Atlas",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
