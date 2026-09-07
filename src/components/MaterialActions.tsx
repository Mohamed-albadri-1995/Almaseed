'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { toggleFavorite, reportContent } from '@/app/actions';

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <button onClick={share} className="btn-outline">
      <Icon.share width={18} height={18} />
      {copied ? 'تم نسخ الرابط' : 'مشاركة'}
    </button>
  );
}

export function FavoriteButton({
  materialId,
  initial,
  loggedIn,
}: {
  materialId: string;
  initial: boolean;
  loggedIn: boolean;
}) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();

  if (!loggedIn) {
    return (
      <Link href="/login" className="btn-outline">
        <Icon.heart width={18} height={18} />
        أضف إلى المفضلة
      </Link>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await toggleFavorite(materialId);
          if (res.ok) setFav(!!res.favorited);
        })
      }
      className={fav ? 'btn-gold' : 'btn-outline'}
    >
      <Icon.heart width={18} height={18} />
      {fav ? 'في المفضلة' : 'أضف إلى المفضلة'}
    </button>
  );
}

const REPORT_REASONS = [
  'محتوى مخالف',
  'مشكلة في حقوق الاستخدام',
  'جودة الملف ضعيفة',
  'بيانات غير صحيحة',
  'الملف لا يعمل',
];

export function ReportButton({ materialId }: { materialId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [contact, setContact] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger"
      >
        <Icon.flag width={15} height={15} />
        الإبلاغ عن مشكلة في المحتوى
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            {done ? (
              <div className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Icon.check width={26} height={26} />
                </span>
                <h3 className="mt-3 text-lg font-bold text-brand-800">تم استلام البلاغ</h3>
                <p className="mt-1 text-sm text-muted">شكراً لك، سيراجع الفريق البلاغ قريباً.</p>
                <button onClick={() => setOpen(false)} className="btn-primary mt-4">إغلاق</button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-brand-800">الإبلاغ عن مشكلة</h3>
                  <button onClick={() => setOpen(false)} aria-label="إغلاق" className="text-muted hover:text-ink">
                    <Icon.x width={20} height={20} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">نوع المشكلة</label>
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">تفاصيل إضافية (اختياري)</label>
                    <textarea
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      rows={3}
                      className="input"
                      placeholder="اشرح المشكلة…"
                    />
                  </div>
                  <div>
                    <label className="label">وسيلة تواصل (اختياري)</label>
                    <input
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="input"
                      placeholder="بريد إلكتروني أو هاتف"
                    />
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const full = detail ? `${reason} — ${detail}` : reason;
                        const res = await reportContent(materialId, full, contact);
                        if (res.ok) setDone(true);
                      })
                    }
                    className="btn-danger flex-1"
                  >
                    إرسال البلاغ
                  </button>
                  <button onClick={() => setOpen(false)} className="btn-outline">إلغاء</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
