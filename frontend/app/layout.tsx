import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "WebCrawler | AI-Powered SEO & Conversion Audit — EIGHT25MEDIA",
  description:
    "WebCrawler by EIGHT25MEDIA — automated deep-dive analysis of SEO and conversion performance. Get grounded, actionable strategies in seconds.",
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-row bg-background text-foreground transition-colors duration-300">
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {/* Persistent collapsible left-hand navigation */}
            <Sidebar />

            {/* Page content fills remaining width */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {children}
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

