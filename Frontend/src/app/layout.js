import "./globals.css";
import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import Providers from "@/app/components/Providers";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

export const metadata = {
  title: "Karupatti Coffee POS",
  description:
    "Say goodbye to waiting in line! Order your favorite coffee from the comfort of your seat and have it delivered directly to you.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KarupattiPOS",
  },
};

export const viewport = {
  themeColor: "#6F4E37",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/Logo.png" />
      </head>
      <body
        className={`${playfairDisplay.variable} ${dmSans.variable} ${jetbrainsMono.variable} font-body`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
