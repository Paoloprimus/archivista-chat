// app/layout.tsx
import './globals.css'; // 👈 IMPORTA LO STILE
export const metadata = {
  title: 'The Archivist',
  description: 'Chat Persistente',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
