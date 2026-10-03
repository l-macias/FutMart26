import type { Metadata } from "next";
import {
  Barlow_Condensed,
  Manrope,
  Teko,
  Titillium_Web,
} from "next/font/google";
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

const v4DisplayFont = Teko({
  subsets: ["latin"],
  variable: "--font-v4-display",
  weight: ["500", "600", "700"],
});

const v4InterfaceFont = Titillium_Web({
  subsets: ["latin"],
  variable: "--font-v4-interface",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "F5 Groups",
  description: "Aplicación de jugadores F5 Groups",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${displayFont.variable} ${interfaceFont.variable} ${v4DisplayFont.variable} ${v4InterfaceFont.variable}`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
