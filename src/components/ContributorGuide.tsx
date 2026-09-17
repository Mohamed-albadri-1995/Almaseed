import Link from 'next/link';
import { Icon } from './icons';

// A friendly, self-contained guide shown above the submission form to make
// publishing easier for contributors. Uses native <details> so it needs no
// client-side JavaScript.

const STEPS: { icon: keyof typeof Icon; title: string; body: React.ReactNode }[] = [
  {
    icon: 'archive',
    title: '١) اختر النوع الصحيح',
    body: (
      <>
        ضع المادة في القسم الأنسب لها (مديح، محاضرة، ندوة، موعظة، مناسبة…) حتى يسهل
        العثور عليها لاحقًا. أقسام المدائح والمحاضرات والندوات والمناسبات تقبل
        <span className="font-semibold text-brand-800"> الصوت والفيديو فقط</span>، أما
        القراءات فتقبل ملفًا أو مقالًا مكتوبًا.
      </>
    ),
  },
  {
    icon: 'headphones',
    title: '٢) ارفع بأفضل جودة مناسبة',
    body: (
      <>
        اختر أوضح نسخة متاحة للملف دون تضخيم الحجم بلا فائدة (حتى ٢٠٠ ميجابايت للملف).
        يمكنك الرفع من جهازك مباشرةً، أو التسجيل بالكاميرا/الميكروفون داخل التطبيق في
        أقسام الصوت والفيديو.
      </>
    ),
  },
  {
    icon: 'edit',
    title: '٣) أكمل البيانات',
    body: (
      <>
        الحقول المعلّمة بنجمة حمراء <span className="font-bold text-danger">*</span>{' '}
        إجبارية، وما عداها اختياري لكنه يرفع قيمة المادة. كلما أضفت معلومات أكثر
        (المادح/المتحدّث، المناسبة، التاريخ، المكان، المصدر) صار الأرشيف أنفع وأسهل
        بحثًا.
      </>
    ),
  },
  {
    icon: 'search',
    title: '٤) تجنّب التكرار',
    body: (
      <>
        قبل الإرسال، ابحث في{' '}
        <Link href="/archive" className="font-semibold text-brand-700 underline">الأرشيف</Link>{' '}
        للتأكد أن المادة غير موجودة. وجودها في منصة أخرى لا يمنع أرشفتها هنا، لكن لا
        داعي لرفع نسخة مكررة داخل الموقع نفسه.
      </>
    ),
  },
  {
    icon: 'check',
    title: '٥) ماذا يحدث بعد الإرسال؟',
    body: (
      <>
        تصل المادة إلى مراجعي القسم للتحقق منها. قد تُنشر مباشرةً، أو يُطلب منك
        تعديل بسيط، أو تُرفض مع بيان السبب. تصلك النتيجة كإشعار، ويمكنك متابعة حالة
        موادك في صفحة{' '}
        <Link href="/account" className="font-semibold text-brand-700 underline">«حسابي»</Link>.
      </>
    ),
  },
];

export function ContributorGuide() {
  return (
    <details
      className="group mb-6 overflow-hidden rounded-2xl border-2 border-gold-300 bg-white shadow-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gold-50 px-5 py-4">
        <span className="flex items-center gap-3">
          {/* Gentle pulse to invite a first-time contributor to open it; it
              stops once the guide is expanded. */}
          <span className="guide-attn group-open:[animation:none] flex h-11 w-11 items-center justify-center rounded-full bg-gold-500 text-white">
            <Icon.sparkle width={22} height={22} />
          </span>
          <span>
            <span className="block text-base font-extrabold text-brand-800">مساعد المساهمين</span>
            <span className="block text-xs text-brand-700/80">نصائح بسيطة تُسرّع قبول مادتك — <span className="font-bold text-gold-700 group-open:hidden">اضغط للفتح</span><span className="hidden font-bold text-gold-700 group-open:inline">اضغط للطي</span>.</span>
          </span>
        </span>
        <Icon.chevronLeft
          width={22}
          height={22}
          className="shrink-0 text-gold-700 transition-transform group-open:-rotate-90"
        />
      </summary>

      <div className="space-y-3 px-5 py-4">
        {STEPS.map((s) => {
          const I = Icon[s.icon] as (p: { width: number; height: number }) => JSX.Element;
          return (
            <div key={s.title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-brand-100">
                <I width={16} height={16} />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-800">{s.title}</p>
                <p className="text-sm leading-7 text-muted">{s.body}</p>
              </div>
            </div>
          );
        })}

        <div className="rounded-xl bg-white p-3 text-xs text-muted ring-1 ring-brand-100">
          تذكّر: المادة المرتبطة بالمسيد وشيوخه وطلابه وتراثه هي الأنسب للأرشيف. للمزيد
          راجع{' '}
          <Link href="/policy#archive-policy" className="font-semibold text-brand-700 underline">شروط النشر</Link>{' '}
          و
          <Link href="/faq" className="font-semibold text-brand-700 underline">الأسئلة الشائعة</Link>.
        </div>
      </div>
    </details>
  );
}
