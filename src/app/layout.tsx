import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import NextAuthProvider from "../components/providers/NextAuthProvider";

// 1. Inisialisasi font Inter di sini
const inter = Inter({ subsets: ["latin"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#10b981", // Emerald 500
};

export const metadata: Metadata = {
  title: "GRUV",
  description: "Stage-ready sequencer for drummers",
  manifest: "/manifest.json", // Pastikan namanya sesuai dengan file manifest yang kamu buat (.json atau .webmanifest)
  icons: {
    icon: [
      { url: '/logo/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/logo/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/logo/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}