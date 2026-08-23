import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "./providers";
import "@football/ui/styles.css";
import "@football/football-ui/styles.css";
import "./styles.css";

const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const interfaceFont = Manrope({
  subsets: ["latin"],
  variable: "--font-interface",
});

export const metadata: Metadata = {
  title: "F5 Groups",
  description: "F5 Groups player application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${interfaceFont.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
