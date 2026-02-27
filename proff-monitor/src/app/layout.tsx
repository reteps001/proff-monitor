import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Playfair_Display } from "next/font/google";
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finn - notifies you about financial statements",
  description: "Monitor Danish companies' financial statements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AnimatedGridPattern
            numSquares={30}
            maxOpacity={0.2}
            duration={3}
            repeatDelay={1}
            className={cn(
              "[mask-image:radial-gradient(100vw_circle_at_center,white,transparent)]",
              "fixed inset-x-0 inset-y-[-30%] h-[200%] skew-y-12",
              "fill-gray-400/30 stroke-gray-400/30 dark:fill-white/10 dark:stroke-white/10",
              "-z-10"
            )}
          />
          <div className="relative z-0">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
