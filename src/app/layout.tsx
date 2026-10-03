import type { Metadata } from 'next';
import './globals.css';
import { PlaygroundProvider } from '@/context/PlaygroundContext';

export const metadata: Metadata = {
  title: 'Verilog Studio | Browser EDA Workbench',
  description: 'Production-grade browser Verilog IDE with Auto-Harness testbench generation, event-driven stratified simulation, High-DPI waveform viewer, and 1-Click EDA export for Vivado and Quartus Prime.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0e14] text-slate-200 antialiased overflow-hidden select-none">
        <PlaygroundProvider>{children}</PlaygroundProvider>
      </body>
    </html>
  );
}
