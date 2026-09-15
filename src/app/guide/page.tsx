import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDE_GROUPS, GUIDE_FLOWS } from '@/lib/guide-data';

export const metadata: Metadata = {
  title: 'الدليل المصوّر',
  description: 'دليل مصوّر خطوة بخطوة لاستخدام أرشيف المسيد: إنشاء الحساب، رفع المواد، المراجعة بخياراتها، والحذف بالتصويت — لكل خطوة لقطة حقيقية والزرّ المطلوب داخل حلقة.',
};

export default function GuideIndex() {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="eyebrow">دليل الاستخدام</p>
          <h1 className="section-title mt-1">الدليل المصوّر خطوة بخطوة</h1>
          <p className="mx-auto mt-2 max-w-2xl text-muted">
            لكل خطوة <span className="font-semibold text-brand-700">لقطة حقيقية</span> من الموقع،
            والزرّ أو الحقل المطلوب داخل <span className="font-semibold text-brand-700">حلقة زرقاء</span>.
            اختر القسم الذي تريده مباشرةً.
          </p>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold-300 bg-gold-50 p-4 text-sm leading-7">
          <span className="text-xl">⚙️</span>
          <p>
            <span className="font-bold text-brand-800">نظامٌ آليٌّ عادل:</span> النشر والتعليق والحذف
            يقرّرها النظام آليًّا وفق السياسات (عدّ الأصوات، مهلة الأسبوع، الإشعارات) — لا ينفرد بها فرد.
            راجع <Link href="/policy" className="font-semibold text-brand-700 hover:underline">السياسات</Link> للتفصيل.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {GUIDE_GROUPS.map((g) => {
            const flows = GUIDE_FLOWS.filter((f) => f.group === g.id);
            return (
              <section key={g.id}>
                <h2 className="text-xl font-extrabold text-brand-800">{g.title}</h2>
                <p className="mt-1 text-sm text-muted">{g.desc}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {flows.map((f) => (
                    <Link
                      key={f.id}
                      href={`/guide/${f.id}`}
                      className="card flex items-start gap-3 p-4 transition hover:border-brand-300 hover:shadow-md"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl">{f.icon}</span>
                      <span>
                        <span className="block font-bold text-brand-800">{f.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">{f.role} · {f.steps.length} خطوات</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
