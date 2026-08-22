export const metadata = {
  title: "ePrint Online - Pay ₹99",
  description: "Instant PDF download after payment",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
