import "./globals.css";

export const metadata = {
  title: "Smart Color Analyzer",
  description: "Extract dominant colors and pick pixels (client-side)"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
