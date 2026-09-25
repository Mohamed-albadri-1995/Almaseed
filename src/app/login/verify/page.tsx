import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { VerifyCodeForm } from '@/components/AuthForms';
import { readPendingChallenge, pendingUserEmail } from '@/lib/two-factor';

export const metadata: Metadata = { title: 'التحقق من الدخول', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function VerifyLoginPage() {
  const pending = await readPendingChallenge();
  if (!pending) redirect('/login');
  const email = await pendingUserEmail(pending.cid);

  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-extrabold text-brand-800">التحقق بخطوتين</h1>
          <p className="mt-2 text-sm leading-7 text-muted">
            لحماية لوحة الإشراف، أرسلنا رمزًا من ٦ أرقام إلى بريدك
            {email ? <> <span dir="ltr" className="font-semibold text-brand-700">{email}</span></> : null}.
            الرمز صالح لمدة ١٠ دقائق.
          </p>
          <div className="mt-6">
            <VerifyCodeForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">الرجوع إلى تسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
