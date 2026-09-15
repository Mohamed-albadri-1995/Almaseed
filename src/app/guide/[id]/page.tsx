import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDE_FLOWS, getGuideFlow, type BtnKind } from '@/lib/guide-data';

export function generateStaticParams() {
  return GUIDE_FLOWS.map((f) => ({ id: f.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const flow = getGuideFlow(params.id);
  if (!flow) return { title: 'الدليل المصوّر' };
  return { title: `${flow.title} — الدليل المصوّر`, description: `خطوات ${flow.title} في أرشيف المسيد، مصوّرة بلقطات حقيقية والزرّ المطلوب محدَّد.` };
}

const BTN: Record<BtnKind, string> = {
  primary: 'bg-brand-700 text-white border-brand-700',
  gold: 'bg-gold-400 text-brand-900 border-gold-400',
  outline: 'bg-transparent text-brand-700 border-ivory-300',
  approve: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  reject: 'bg-red-50 text-red-700 border-red-300',
  edit: 'bg-sky-50 text-sky-700 border-sky-300',
};

export default function GuideFlowPage({ params }: { params: { id: string } }) {
  const flow = getGuideFlow(params.id);
  if (!flow) notFound();
  const idx = GUIDE_FLOWS.findIndex((f) => f.id === flow.id);
  const prev = GUIDE_FLOWS[idx - 1];
  const next = GUIDE_FLOWS[idx + 1];

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-4 flex items-center gap-1 text-sm text-muted">
          <Link href="/guide" className="hover:text-brand-600">الدليل المصوّر</Link>
          <span>/</span>
          <span className="text-brand-700">{flow.title}</span>
        </nav>

        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl">{flow.icon}</span>
          <div>
            <h1 className="text-2xl font-extrabold text-brand-800">{flow.title}</h1>
            <p className="mt-1 text-sm">
              <span className="rounded-full border border-gold-300 bg-gold-50 px-2.5 py-0.5 text-xs font-bold text-gold-700">{flow.role}</span>
              <span className="mr-2 text-muted">📍 {flow.where}</span>
            </p>
          </div>
        </div>

        <ol className="mt-8 space-y-6">
          {flow.steps.map((s, i) => (
            <li key={i} className="rounded-2xl border border-ivory-300 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 text-sm font-extrabold text-gold-700">{i + 1}</span>
                <div className="flex-1">
                  <p className="leading-8 text-ink/90" dangerouslySetInnerHTML={{ __html: s.t }} />
                  {s.btn && (
                    <span className="mt-2 inline-flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-bold ${BTN[s.btn[1]]}`}>{s.btn[0]}</span>
                      <span className="text-xs font-bold text-sky-500">⟵ الزرّ المطلوب</span>
                    </span>
                  )}
                </div>
              </div>
              {s.shot && (
                <figure className="mt-3">
                  <div className="mx-auto max-w-[320px] overflow-hidden rounded-xl border border-ivory-300 bg-ivory-50 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.shot} alt={`${flow.title} — خطوة ${i + 1}`} loading="lazy" className="block w-full" />
                  </div>
                  {s.cap && <figcaption className="mt-1.5 text-center text-xs text-muted">📷 {s.cap}</figcaption>}
                </figure>
              )}
            </li>
          ))}
        </ol>

        {flow.result && (
          <p className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-800">
            ✅ <span className="font-bold">النتيجة:</span> {flow.result}
          </p>
        )}
        {flow.note && (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800"
             dangerouslySetInnerHTML={{ __html: `ℹ️ ${flow.note}` }} />
        )}

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-ivory-200 pt-6 text-sm">
          {prev ? <Link href={`/guide/${prev.id}`} className="btn-outline">→ {prev.title}</Link> : <span />}
          <Link href="/guide" className="text-muted hover:text-brand-600">كل الأقسام</Link>
          {next ? <Link href={`/guide/${next.id}`} className="btn-outline">{next.title} ←</Link> : <span />}
        </div>
      </div>
    </div>
  );
}
