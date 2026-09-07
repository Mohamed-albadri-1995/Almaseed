'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { loginAction, registerAction, type AuthState } from '@/app/auth-actions';

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
        <Link href="#" className="text-brand-600 hover:underline">نسيت كلمة المرور؟</Link>
      </div>
      <SubmitButton label="دخول" />
    </form>
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
