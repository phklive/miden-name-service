import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miden name service",
  description: "A name service for the Miden blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
