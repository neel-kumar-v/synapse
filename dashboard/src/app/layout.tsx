import type { Metadata } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DevConsoleFilter } from "@/components/DevConsoleFilter";
import { Inter, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";


const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Synapse",
  description: "",
  icons: [
    {
      rel: "icon",
      type: "image/svg+xml",
      url: "/synapse.svg",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      type: "image/png",
      url: "/synapse.png",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      type: "image/svg+xml",
      url: "/synapse-light.svg",
      media: "(prefers-color-scheme: dark)",
    },
    {
      rel: "icon",
      type: "image/png",
      url: "/synapse-light.png",
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `
    (function() {
      try {
        var k = 'synapse-theme';
        var stored = localStorage.getItem(k);
        var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', dark);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased bg-background text-foreground`}
      >
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
        <ThemeProvider initialTheme="light">
          <ConvexClientProvider>
            <UserProvider>
              <TooltipProvider>
                <DevConsoleFilter />
                <div className="min-h-screen w-full flex flex-col">{children}</div>
                <Toaster />
              </TooltipProvider>
            </UserProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
