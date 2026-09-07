import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = {
  title: {
    default: 'أرشيف المسيد — صوتٌ يُحفظ، وأثرٌ لا يغيب',
    template: '%s • أرشيف المسيد',
  },
  description:
    'أرشيف مفتوح للمدائح والمحاضرات والندوات والمواعظ والمناسبات، نجمع فيه ما يستحق أن يبقى قريباً من القلب.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&family=Aref+Ruqaa:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <Navbar
          user={
            user
              ? { name: user.name, role: user.role, email: user.email }
              : null
          }
        />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
