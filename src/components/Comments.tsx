'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { postComment, deleteComment } from '@/app/actions';
import { timeAgo } from '@/lib/format';

export interface ReplyItem {
  id: string;
  body: string;
  createdAt: string | Date;
  authorName: string;
  authorId: string;
}
export interface CommentItem extends ReplyItem {
  replies: ReplyItem[];
}

// Comments with one level of replies (like YouTube). Reading is public;
// writing needs an account. The author or staff can delete.
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
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [pending, start] = useTransition();
  const total = list.reduce((n, c) => n + 1 + c.replies.length, 0);

  const add = () => {
    setError('');
    start(async () => {
      const res = await postComment(materialId, body);
      if (res.ok) {
        setList((l) => [{ ...res.comment, replies: [] }, ...l]);
        setBody('');
      } else {
        setError(res.error ?? 'تعذّر إرسال التعليق');
      }
    });
  };

  const reply = (parentId: string) => {
    setError('');
    start(async () => {
      const res = await postComment(materialId, replyBody, parentId);
      if (res.ok) {
        setList((l) => l.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, res.comment] } : c)));
        setReplyBody('');
        setReplyTo(null);
      } else {
        setError(res.error ?? 'تعذّر إرسال الرد');
      }
    });
  };

  const remove = (id: string) => {
    start(async () => {
      const res = await deleteComment(id);
      if (res.ok) {
        setList((l) => l.filter((c) => c.id !== id).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) })));
      }
    });
  };

  const Item = ({ c, small = false }: { c: ReplyItem; small?: boolean }) => (
    <div className="flex items-start gap-3">
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ${small ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'}`}>
        {c.authorName.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold text-brand-800">{c.authorName}</span>
            <span className="ms-2 text-xs text-muted">{timeAgo(c.createdAt)}</span>
          </p>
          {(canModerate || c.authorId === currentUserId) && (
            <button onClick={() => remove(c.id)} disabled={pending} className="text-muted hover:text-danger" aria-label="حذف">
              <Icon.x width={15} height={15} />
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-line text-sm leading-7 text-ink/90">{c.body}</p>
      </div>
    </div>
  );

  return (
    <section id="comments" className="mt-10 scroll-mt-24">
      <h2 className="section-title mb-4 text-xl">
        التعليقات {total > 0 && <span className="text-muted">({total})</span>}
      </h2>

      {loggedIn ? (
        <div className="card mb-6 p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="input"
            placeholder="أضف تعليقًا…"
            maxLength={1000}
          />
          {error && !replyTo && <p className="mt-1 text-xs text-danger">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button onClick={add} disabled={pending || body.trim().length < 2} className="btn-primary">
              {pending && !replyTo ? 'جارٍ…' : 'تعليق'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card mb-6 p-4 text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">سجّل الدخول</Link>{' '}
          للتعليق والرد.
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">لا توجد تعليقات بعد — كن أول من يعلّق.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className="card p-4">
              <Item c={c} />
              <div className="ms-12">
                {loggedIn && (
                  <button
                    onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyBody(''); setError(''); }}
                    className="mt-1 text-xs font-bold text-brand-700 hover:underline"
                  >
                    ردّ
                  </button>
                )}
                {c.replies.length > 0 && (
                  <ul className="mt-3 space-y-3 border-s-2 border-brand-100 ps-3">
                    {c.replies.map((r) => (
                      <li key={r.id}><Item c={r} small /></li>
                    ))}
                  </ul>
                )}
                {replyTo === c.id && (
                  <div className="mt-3">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={2}
                      className="input"
                      placeholder={`ردّ على ${c.authorName}…`}
                      maxLength={1000}
                      autoFocus
                    />
                    {error && <p className="mt-1 text-xs text-danger">{error}</p>}
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setReplyTo(null)} className="btn-ghost text-sm">إلغاء</button>
                      <button onClick={() => reply(c.id)} disabled={pending || replyBody.trim().length < 2} className="btn-primary">
                        {pending ? 'جارٍ…' : 'ردّ'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
