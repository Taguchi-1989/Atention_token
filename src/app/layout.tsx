import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegistrar from '@/components/PwaRegistrar';

const basePath = process.env.BASE_PATH || '';

export const metadata: Metadata = {
  title: 'Attention Ledger',
  description: 'AI-based attention cost measurement',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/talkbalancer-icon.svg`,
    apple: `${basePath}/talkbalancer-icon-192.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TalkBalancer',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#06d6e8',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="font-sans antialiased">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
