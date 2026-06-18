import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata = {
  title: "Scout — NorthBound Advisory",
  description:
    "Paste a client URL and pain points; get a grounded, editable automation-discovery deliverable in minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
