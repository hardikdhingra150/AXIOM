import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'AXIOM — Virtual FSOC Laboratory', description:'An interactive coarse-alignment simulation prototype by Naut IQ. SIH problem statement 26169.'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
