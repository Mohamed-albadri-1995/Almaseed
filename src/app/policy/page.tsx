import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'السياسات وشروط النشر' };

export default function PolicyPage() {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl space-y-10 leading-8 text-ink/90">
        <div>
          <p className="eyebrow">الشفافية أولاً</p>
          <h1 className="section-title mt-1">السياسات وشروط النشر</h1>
        </div>

        <section id="publishing">
          <h2 className="text-xl font-bold text-brand-800">شروط نشر المحتوى</h2>
          <ul className="mt-3 list-disc space-y-2 pr-6 text-muted">
            <li>أن يكون المحتوى نافعاً ومتوافقاً مع طبيعة الأرشيف العلمية والدينية.</li>
            <li>أن يملك المساهم حق مشاركة المادة، وألا تخالف حقوق الآخرين.</li>
            <li>أن تكون البيانات المرفقة صحيحة قدر الإمكان (المادح، المناسبة، التاريخ…).</li>
            <li>تخضع كل مادة للمراجعة قبل النشر، وقد يُطلب تعديلها أو تُرفض مع بيان السبب.</li>
          </ul>
        </section>

        <section id="usage">
          <h2 className="text-xl font-bold text-brand-800">سياسة الاستخدام</h2>
          <p className="mt-3 text-muted">
            المحتوى متاح للاستماع والمشاهدة والتنزيل لأغراض الانتفاع الشخصي والدعوي.
            يُرجى عند إعادة النشر الإشارة إلى المصدر، وعدم استخدام المحتوى فيما يخالف
            مقاصده.
          </p>
        </section>

        <section id="privacy">
          <h2 className="text-xl font-bold text-brand-800">سياسة الخصوصية</h2>
          <p className="mt-3 text-muted">
            لا نطلب من الزائر بيانات للتصفّح أو التنزيل. عند إنشاء حساب نحفظ الحد الأدنى
            من البيانات اللازمة (الاسم، وسيلة التواصل) لإدارة المساهمات والإشعارات، ولا
            نشاركها مع جهات خارجية.
          </p>
        </section>

        <section id="rights">
          <h2 className="text-xl font-bold text-brand-800">حقوق الاستخدام والإبلاغ</h2>
          <p className="mt-3 text-muted">
            إذا كنت صاحب حق في مادة منشورة وترى أنها نُشرت دون إذن، أو لاحظت مشكلة في أي
            محتوى، يمكنك استخدام رابط «الإبلاغ عن مشكلة» في صفحة المادة أو صفحة «تواصل
            معنا»، وسنراجع البلاغ ونتخذ الإجراء المناسب.
          </p>
        </section>
      </div>
    </div>
  );
}
