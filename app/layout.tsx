// app/layout.tsx

export const metadata = {
  title: 'Archivista AI Chat',
  description: 'Chat persistente con Claude',
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
