import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Aegis Alpha — Local-first trading research',
  description: 'A safety-first AI research and paper-trading terminal for multi-asset markets.',
  openGraph: {
    title: 'Aegis Alpha',
    description: 'Research first. Risk always.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aegis Alpha',
    description: 'Research first. Risk always.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
