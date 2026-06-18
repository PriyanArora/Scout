import "./globals.css";
import localFont from "next/font/local";
import { Geist_Mono, Bebas_Neue } from "next/font/google";
import { SiteHeader } from "@/components/site-header";

// Body / UI type — PP Right Grotesk (local OTF, Free For Personal Use). Text cut
// for copy, Display Medium for headings, exposed as --font-sans.
const sans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/PPRightGroteskText-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/PPRightGroteskText-RegularItalic.otf", weight: "400", style: "italic" },
    { path: "./fonts/PPRightGrotesk-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/PPRightGrotesk-Medium.otf", weight: "600", style: "normal" },
    { path: "./fonts/PPRightGrotesk-Medium.otf", weight: "700", style: "normal" },
  ],
});

// Logo wordmark only — a tall condensed display face, deliberately different from
// the body Grotesk. Exposed as --font-logo, used by .brand.
const logo = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-logo", display: "swap" });

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata = {
  title: "Scout",
  description:
    "Paste a client URL, explore the automation opportunities Scout finds, and export a ready-to-import n8n workflow.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${logo.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
