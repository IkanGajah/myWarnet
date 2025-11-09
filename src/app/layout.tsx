import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Warnet",
  description: "OP Warnet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
     <html lang="id">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-gray-100 shadow-sm">
            <div className="container mx-auto p-4 flex items-center justify-between">
              <h1 className="text-xl font-bold">Warnetku</h1>
              <nav className="space-x-4">
                <Link href="./" className="text-sm">Home</Link>
                <Link href="./user" className="text-sm">Komputer</Link>
                <Link href="./admin" className="text-sm">Atmint</Link>
              </nav>
            </div>
          </header>

          <main className="container mx-auto p-6 flex-1">{children}</main>

          <footer className="bg-gray-100 border-t py-4 text-center text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Warnetku
          </footer>
        </div>
      </body>
    </html>
  );
}
