import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "AI Product Factory — Build Products with Multi-Agent AI",
    template: "%s | AI Product Factory",
  },
  description: "Turn a product idea into researched open-source options, approved architecture, commercial assumptions, and a verified build plan using a customer-selected AI model.",
  applicationName: "AI Product Factory",
  keywords: [
    "AI Product Factory",
    "multi-agent AI",
    "product research",
    "open-source architecture",
    "AI product builder",
  ],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
