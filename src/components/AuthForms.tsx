'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import Script from 'next/script';
import { loginAction, registerAction, verifyLoginCodeAction, resendLoginCodeAction, type AuthState } from '@/app/auth-actions';

const initial: AuthState = {};

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
    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {error}
    </div>
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useFormState(loginAction, initial);
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
      />

      <form action={action} className="space-y-4">
        <ErrorBox error={state.error} />
        <input type="hidden" name="redirect" value={redirectTo ?? '/account'} />
        <div>
          <label className="label" htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="password">كلمة المرور</label>
          <input id="password" name="password" type="password" required className="input" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" name="remember" className="rounded" defaultChecked />
            تذكرني
          </label>
          <Link href="/forgot-password" className="text-brand-600 hover:underline">نسيت كلمة المرور؟</Link>
        </div>
        <SubmitButton label="دخول" />
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-muted">
        <div className="h-px flex-1 bg-gray-200" />
        <span>أو</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div
        id="g_id_onload"
        data-client_id="118742835785-l0n4p7b7souh54j8s1fhlnlk20hefrb2.apps.googleusercontent.com"
        data-login_uri="https://almaseeed.com/api/auth/google"
        data-ux_mode="redirect"
        data-auto_prompt="false"
      />

      <div className="w-full overflow-hidden flex justify-center">
        <div
          className="g_id_signin"
          data-type="standard"
          data-size="large"
          data-theme="outline"
          data-text="signin_with"
          data-shape="rectangular"
          data-width="100%"
        />
      </div>
    </>
  );
}

export function RegisterForm() {
  const [state, action] = useFormState(registerAction, initial);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox error={state.error} />
      <div>
        <label className="label" htmlFor="name">الاسم الكامل</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required className="input" dir="ltr" />
      </div>
      <div>
        <label className="label" htmlFor="password">كلمة المرور</label>
        <input id="password" name="password" type="password" required className="input" />
        <p className="field-hint">6 أحرف على الأقل.</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" required className="mt-1 rounded" />
        <span>أوافق على شروط الاستخدام وسياسة النشر.</span>
      </label>
      <SubmitButton label="إنشاء حساب" />
    </form>
  );
}

// Second step of a staff sign-in: the 6-digit code emailed after the password.
export function VerifyCodeForm() {
  const [state, action] = useFormState(verifyLoginCodeAction, initial);
  const [resend, setResend] = useState<{ busy?: boolean; msg?: string; error?: string }>({});
  return (
    <form action={action} className="space-y-4">
      <ErrorBox error={state.error || resend.error} />
      {resend.msg && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{resend.msg}</div>}
      <div>
        <label className="label" htmlFor="code">رمز التحقق</label>
        <input
          id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}"
          maxLength={7} dir="ltr" autoFocus placeholder="••••••"
          className="input text-center text-2xl font-bold tracking-[0.5em]"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="trust" className="rounded" defaultChecked />
        تذكّر هذا الجهاز ٣٠ يومًا (لا تفعّله على جهاز مشترك)
      </label>
      <SubmitButton label="تأكيد الدخول" />
      <button
        type="button"
        disabled={resend.busy}
        onClick={async () => {
          setResend({ busy: true });
          const r = await resendLoginCodeAction();
          setResend(r.error ? { error: r.error } : { msg: 'أُرسل رمز جديد إلى بريدك.' });
        }}
        className="w-full text-center text-sm font-semibold text-brand-700 hover:underline disabled:opacity-50"
      >
        {resend.busy ? 'جارٍ الإرسال…' : 'لم يصلك الرمز؟ أرسل رمزًا جديدًا'}
      </button>
    </form>
  );
}
