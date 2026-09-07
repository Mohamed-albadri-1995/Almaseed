'use client';

import { useState } from 'react';
import { Icon } from './icons';
import { reviewDecisionAction } from '@/app/admin/actions';
import { REVIEW_REASONS, REVIEW_ACTIONS } from '@/lib/constants';

// The reviewer's decision controls: choose an action, add a reason/note when
// requesting an edit or rejecting, then submit.
export function ReviewPanel({
  materialId,
  errorReason,
}: {
  materialId: string;
  errorReason?: boolean;
}) {
  const [action, setAction] = useState<string>('');

  const needsReason =
    action === REVIEW_ACTIONS.REQUEST_EDIT || action === REVIEW_ACTIONS.REJECT;

  return (
    <form action={reviewDecisionAction} className="card p-5">
      <h2 className="mb-1 text-lg font-bold text-brand-800">قرار المراجعة</h2>
      <p className="mb-4 text-sm text-muted">اختر الإجراء المناسب لهذه المادة.</p>

      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="action" value={action} />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAction(REVIEW_ACTIONS.APPROVE)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
            action === REVIEW_ACTIONS.APPROVE
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-ivory-300 text-brand-700 hover:bg-ivory-50'
          }`}
        >
          <Icon.check width={18} height={18} /> موافقة ونشر
        </button>
        <button
          type="button"
          onClick={() => setAction(REVIEW_ACTIONS.REQUEST_EDIT)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
            action === REVIEW_ACTIONS.REQUEST_EDIT
              ? 'border-sky-500 bg-sky-50 text-sky-700'
              : 'border-ivory-300 text-brand-700 hover:bg-ivory-50'
          }`}
        >
          <Icon.edit width={18} height={18} /> طلب تعديل
        </button>
        <button
          type="button"
          onClick={() => setAction(REVIEW_ACTIONS.REJECT)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
            action === REVIEW_ACTIONS.REJECT
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-ivory-300 text-brand-700 hover:bg-ivory-50'
          }`}
        >
          <Icon.x width={18} height={18} /> رفض المادة
        </button>
        <button
          type="button"
          onClick={() => setAction(REVIEW_ACTIONS.DRAFT)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
            action === REVIEW_ACTIONS.DRAFT
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-ivory-300 text-brand-700 hover:bg-ivory-50'
          }`}
        >
          <Icon.file width={18} height={18} /> حفظ كمسودة
        </button>
      </div>

      {(needsReason || errorReason) && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">السبب (إلزامي)</label>
            <select name="reason" required={needsReason} className="input">
              <option value="">اختر السبب…</option>
              {REVIEW_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {errorReason && (
              <p className="mt-1 text-xs text-danger">يجب اختيار سبب عند طلب التعديل أو الرفض.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="label">ملاحظة للمساهم (اختياري)</label>
        <textarea name="note" rows={3} className="input" placeholder="اكتب توضيحاً يظهر للمساهم…" />
      </div>

      <button
        type="submit"
        disabled={!action}
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        تأكيد القرار
      </button>
    </form>
  );
}
