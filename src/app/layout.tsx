import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Waduk Landung - Sistem Manajemen RT Digital",
  description: "Aplikasi manajemen RT untuk data warga, ronda, jimpitan, selapanan, keuangan, dan lainnya",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
