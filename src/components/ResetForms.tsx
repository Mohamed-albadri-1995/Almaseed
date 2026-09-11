'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type ResetState,
} from '@/app/auth-actions';

const initial: ResetState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'جارٍ…' : label}
    </button>
  );
}

function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormState(requestPasswordResetAction, initial);

  if (state.sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          إذا كان البريد مسجّلاً لدينا، فقد أرسلنا إليه رابطًا لإعادة تعيين كلمة المرور.
          تحقّق من بريدك (ومجلد الرسائل غير المرغوبة). الرابط صالح لمدة ساعة.
        </div>
        <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
          العودة لتسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <ErrorBox error={state.error} />
      <p className="text-sm text-muted">
        أدخل بريدك الإلكتروني المسجّل، وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.
      </p>
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" dir="ltr" />
      </div>
      <SubmitButton label="إرسال رابط الاستعادة" />
      <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
        العودة لتسجيل الدخول
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormState(resetPasswordAction, initial);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox error={state.error} />
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">كلمة المرور الجديدة</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="8 أحرف على الأقل" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">تأكيد كلمة المرور</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className="input" />
      </div>
      <SubmitButton label="حفظ كلمة المرور" />
    </form>
  );
}
