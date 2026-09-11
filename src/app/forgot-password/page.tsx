import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/ResetForms';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'استعادة كلمة المرور' };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect('/account');

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold text-brand-800">استعادة كلمة المرور</h1>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
