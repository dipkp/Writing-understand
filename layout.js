import './globals.css';

export const metadata = {
  title: 'Sellexplain',
  description: 'Select any word, phrase or sentence and get a simple explanation.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
