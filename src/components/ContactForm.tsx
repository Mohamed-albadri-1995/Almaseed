'use client';

import { useState, useTransition } from 'react';
import { Icon } from './icons';
import { sendContactMessage } from '@/app/actions';

export function ContactForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Icon.check width={26} height={26} />
        </span>
        <h2 className="text-lg font-bold text-brand-800">تم استلام رسالتك</h2>
        <p className="text-sm text-muted">شكراً لتواصلك، سنعود إليك في أقرب وقت.</p>
      </div>
    );
  }

  return (
    <form
      className="card space-y-4 p-6"
      action={(fd) =>
        start(async () => {
          setError('');
          const res = await sendContactMessage({
            name: String(fd.get('name') ?? ''),
            email: String(fd.get('email') ?? ''),
            message: String(fd.get('message') ?? ''),
          });
          if (res.ok) setDone(true);
          else setError(res.error ?? 'تعذّر الإرسال');
        })
      }
    >
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}
      <div>
        <label className="label" htmlFor="name">الاسم</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" className="input" dir="ltr" />
      </div>
      <div>
        <label className="label" htmlFor="message">الرسالة</label>
        <textarea id="message" name="message" rows={5} required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'جارٍ الإرسال…' : 'إرسال'}
      </button>
    </form>
  );
}
