import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// One variable family for display and interface (optical sizing keeps small text crisp),
// plus a monospace for hashes, commands and diffs.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

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
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#08070f" },
  ],
};

// Runs before first paint so the stored theme never flashes. Dark is the default.
const themeScript = `try{var t=localStorage.getItem("gp-theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${bricolage.variable} ${jetbrains.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
