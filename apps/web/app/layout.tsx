import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "VoiceDev Orchestrator",
  description: "Voice-guided multi-agent coding cockpit",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-cockpit-border">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="font-mono text-sm text-cockpit-accent">
                voicedev://orchestrator
              </Link>
              <nav className="flex gap-5 text-sm text-cockpit-muted">
                <Link href="/" className="hover:text-slate-200">
                  Dashboard
                </Link>
                <Link href="/projects/new" className="hover:text-slate-200">
                  New project
                </Link>
                <Link href="/settings" className="hover:text-slate-200">
                  Settings
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
