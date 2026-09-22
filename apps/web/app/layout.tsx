import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { colors } from '@morrow/tokens';
import { Grain } from '@/components/Grain';
import './globals.css';

const serif = Instrument_Serif({ weight: '400', style: 'normal', subsets: ['latin'], variable: '--font-instrument-serif' });
const sans = Geist({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-geist' });
const mono = Geist_Mono({ weight: '400', subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Morrow', template: '%s — Morrow' },
  description: 'A fortune teller that reads your days. One reading a day, sealed at dawn.',
};

export const viewport: Viewport = {
  themeColor: colors.bg,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-bg text-text">
        {children}
        <Grain />
      </body>
    </html>
  );
}
