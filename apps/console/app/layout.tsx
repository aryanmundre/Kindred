import "../styles/globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Kindred Console",
  description: "Register and orchestrate Kindred agents"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header>
            <div className="flex-between">
              <div>
                <h1>Kindred Console</h1>
                <p>Register, validate, and orchestrate autonomous agents</p>
              </div>
              <nav className="flex gap-4">
                <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Agents
                </Link>
                <Link href="/register" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Register
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
