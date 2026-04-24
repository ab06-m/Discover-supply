import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ShoppingCart, LayoutGrid } from "lucide-react";

const inter = Inter({ subsets: ["latin"], weight: ['400', '600', '700'] });

export const metadata: Metadata = {
  title: "Discover Supply | Premium B2B Commerce",
  description: "Your trusted partner for wholesale distribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="navbar glass">
          <div className="container nav-content">
            <Link href="/" className="logo">
              <LayoutGrid size={24} className="logo-icon" />
              <span>Discover Supply</span>
            </Link>
            <div className="nav-actions">
              <Link href="/cart" className="cart-btn">
                <ShoppingCart size={20} />
                <span className="cart-count">2</span>
              </Link>
              <button className="btn btn-primary">Sign In</button>
            </div>
          </div>
        </nav>
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
