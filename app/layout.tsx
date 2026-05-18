import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "geo-agent · multi-agent GEO content distribution",
  description:
    "Planner → Executor → Reviewer pipeline for Generative Engine Optimization content distribution. OpenAI-compatible, runs locally on Ollama or against MiMo-V2.5.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-mono bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
