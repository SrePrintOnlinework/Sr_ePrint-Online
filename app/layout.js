export const metadata = {
  title: 'ePrint Online',
  description: 'Pay and download your PDF receipt instantly',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
