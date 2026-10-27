import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Martian_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Headlines are set like commit messages (Martian Mono, narrowed), body copy in Space Grotesk,
// and hashes, commands and diffs in JetBrains Mono.
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"], axes: ["wdth"] });
const grotesk = localFont({
  // Latin subset of SpaceGrotesk-Variable.ttf (the source file kept beside it), 32 KB instead of 137 KB.
  src: "./fonts/SpaceGrotesk-Latin.woff",
  variable: "--font-grotesk",
  weight: "300 700",
  display: "swap",
});
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GitPrism — Git makes sense when you can see it",
  description:
    "Explore the objects, snapshots and connections that make Git work. An interactive, visual way to understand blobs, trees, commits and history.",
  metadataBase: new URL("https://gitprism.dev"),
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "GitPrism",
    description: "Stop memorizing Git. Start seeing it.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#08070f" },
  ],
};

// Runs before first paint so the stored theme never flashes. Dark is the default.
const themeScript = `try{var t=localStorage.getItem("gp-theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${martian.variable} ${grotesk.variable} ${jetbrains.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
