import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "EIGHT25MEDIA | Enterprise Website Audit Tool",
  description:
    "Enterprise-grade website single-page crawler and AI audit suite using Instructor and Pydantic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-row bg-slate-950">
        {/* Persistent collapsible left-hand navigation */}
        <Sidebar />

        {/* Page content fills remaining width */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
