import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/ResetForms';

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة' };

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold text-brand-800">تعيين كلمة مرور جديدة</h1>
          <p className="mt-1 text-sm text-muted">اختر كلمة مرور جديدة لحسابك.</p>
          <div className="mt-6">
            <ResetPasswordForm token={params.token} />
          </div>
        </div>
      </div>
    </div>
  );
}
