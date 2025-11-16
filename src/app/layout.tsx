import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";

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
      <body className="min-h-screen flex flex-col">
          <Navbar />
          <main className="container mx-auto p-6 flex-1">{children}</main>
          <Footer />
      </body>
    </html>
  );
}
