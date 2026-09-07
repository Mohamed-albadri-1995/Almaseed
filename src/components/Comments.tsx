'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { postComment, deleteComment } from '@/app/actions';
import { timeAgo } from '@/lib/format';

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string | Date;
  authorName: string;
  authorId: string;
}

export function Comments({
  materialId,
  comments,
  loggedIn,
  currentUserId,
  canModerate,
}: {
  materialId: string;
  comments: CommentItem[];
  loggedIn: boolean;
  currentUserId?: string;
  canModerate: boolean;
}) {
  const [list, setList] = useState(comments);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const add = () => {
    setError('');
    start(async () => {
      const res = await postComment(materialId, body);
      if (res.ok) {
        // optimistic prepend; the id will be corrected on next load
        setList((l) => [
          { id: `tmp-${Date.now()}`, body: body.trim(), createdAt: new Date(), authorName: 'أنت', authorId: currentUserId ?? '' },
          ...l,
        ]);
        setBody('');
      } else {
        setError(res.error ?? 'تعذّر إرسال التعليق');
      }
    });
  };

  const remove = (id: string) => {
    start(async () => {
      const res = await deleteComment(id);
      if (res.ok) setList((l) => l.filter((c) => c.id !== id));
    });
  };

  return (
    <section className="mt-10">
      <h2 className="section-title mb-4 text-xl">
        التعليقات {list.length > 0 && <span className="text-muted">({list.length})</span>}
      </h2>

      {loggedIn ? (
        <div className="card mb-6 p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="input"
            placeholder="شارك رأيك أو أضف معلومة عن هذه المادة…"
            maxLength={1000}
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button onClick={add} disabled={pending || body.trim().length < 2} className="btn-primary">
              {pending ? 'جارٍ…' : 'إضافة تعليق'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card mb-6 p-4 text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">سجّل الدخول</Link>{' '}
          لإضافة تعليق.
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">لا توجد تعليقات بعد — كن أول من يعلّق.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {c.authorName.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-800">{c.authorName}</p>
                    <p className="text-xs text-muted">{timeAgo(c.createdAt)}</p>
                  </div>
                </div>
                {(canModerate || c.authorId === currentUserId) && !c.id.startsWith('tmp-') && (
                  <button
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="text-muted hover:text-danger"
                    aria-label="حذف"
                  >
                    <Icon.x width={16} height={16} />
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink/90">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
