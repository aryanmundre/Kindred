import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Kindred Console",
  description: "Register and orchestrate Kindred agents"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header style={{ marginBottom: 32 }}>
            <h1>Kindred Console</h1>
            <p>90 seconds from zero to validated agent.</p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
