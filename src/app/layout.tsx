import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "GitPrism — Git makes sense when you can see it",
  description:
    "Explore the objects, snapshots and connections that make Git work. An interactive, visual way to understand blobs, trees, commits and history.",
  metadataBase: new URL("https://gitprism.dev"),
  openGraph: {
    title: "GitPrism",
    description: "Stop memorizing Git. Start seeing it.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#121018" },
  ],
};

// Runs before first paint so the stored theme never flashes.
const themeScript = `try{var t=localStorage.getItem("gp-theme");if(t!=="light"&&t!=="dark")t="light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${instrument.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
