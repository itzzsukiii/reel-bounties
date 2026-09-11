import './globals.css';

export const metadata = {
  title: 'Creator Core | Creator Bounties & Campaigns',
  description: 'Earn rewards, claim UPI payouts, and connect with top brands and creators.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
