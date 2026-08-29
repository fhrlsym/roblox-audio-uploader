import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "S2 Studio — Roblox Audio Suite",
  description: "Konversi, tuning, dan batch upload audio ke Roblox dalam satu workspace. Created by fhrlsym.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem('audioUploader_settings')||'{}');var t=s.theme||'default',m=s.mode||'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-mode',m)}catch(e){document.documentElement.setAttribute('data-theme','default');document.documentElement.setAttribute('data-mode','light')}`,
          }}
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
