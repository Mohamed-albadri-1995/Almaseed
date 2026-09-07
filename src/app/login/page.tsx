import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/AuthForms';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect(searchParams.redirect || '/account');

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold text-brand-800">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-muted">
            سجّل الدخول للمساهمة ومتابعة موادك والمفضلة.
          </p>
          <div className="mt-6">
            <LoginForm redirectTo={searchParams.redirect} />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="font-semibold text-brand-700 hover:underline">
              أنشئ حساباً
            </Link>
          </p>
        </div>
        <div className="mt-4 rounded-xl bg-ivory-50 p-4 text-xs leading-6 text-muted">
          <p className="font-semibold text-brand-700">حسابات تجريبية (كلمة المرور: password123):</p>
          <p dir="ltr" className="text-right">admin@almaseed.app · reviewer@almaseed.app · contributor@almaseed.app</p>
        </div>
      </div>
    </div>
  );
}
