import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { RegisterForm } from '@/components/AuthForms';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/account');

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold text-brand-800">إنشاء حساب جديد</h1>
          <p className="mt-1 text-sm text-muted">
            التسجيل مطلوب فقط للمساهمة والمفضلة ومتابعة الإرسالات — التصفّح والتنزيل متاحان للجميع.
          </p>
          <div className="mt-6">
            <RegisterForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
