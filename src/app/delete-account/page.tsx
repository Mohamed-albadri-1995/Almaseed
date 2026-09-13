import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'حذف الحساب — تطبيق أرشيف المسيد',
  description:
    'كيفية طلب حذف حسابك وبياناتك الشخصية في تطبيق «الطريقة السمّانية — السجادة السليمانية» (أرشيف المسيد): الخطوات، والبيانات التي تُحذف والتي قد تبقى.',
};

// Dedicated account-deletion page (required by Google Play for apps that support
// account creation). Kept at a stable, publicly accessible URL:
// https://almaseeed.com/delete-account
export default function DeleteAccountPage() {
  const updated = 'سبتمبر 2025';
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl space-y-8 leading-8 text-ink/90">
        <div>
          <p className="eyebrow">الحساب</p>
          <h1 className="section-title mt-1">حذف الحساب والبيانات</h1>
          <p className="mt-2 text-sm text-muted">
            تطبيق «الطريقة السمّانية — السجادة السليمانية» (أرشيف المسيد) · آخر تحديث: {updated}
          </p>
        </div>

        <section className="space-y-3">
          <p className="text-muted">
            يمكنك طلب حذف حسابك وجميع بياناتك الشخصية المرتبطة به في أي وقت. تصفّح
            الأرشيف وتشغيل المواد لا يتطلّب حسابًا؛ هذه الصفحة تخصّ من أنشأ حسابًا
            (بالبريد وكلمة المرور أو عبر تسجيل الدخول بحساب Google).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">خطوات طلب الحذف</h2>
          <ol className="list-decimal space-y-2 pr-6 text-muted">
            <li>
              افتح{' '}
              <Link href="/contact" className="font-bold text-brand-700 underline">
                صفحة «تواصل معنا»
              </Link>{' '}
              أو راسلنا مباشرةً على البريد:{' '}
              <span className="font-bold text-brand-800" dir="ltr">
                mohamed.a.albadri@gmail.com
              </span>
              .
            </li>
            <li>
              اكتب في الرسالة عبارة <span className="font-bold text-brand-800">«طلب حذف الحساب»</span>،
              وأرسلها من البريد الإلكتروني نفسه المسجّل في حسابك (أو اذكر البريد المسجّل)
              حتى نتحقّق من ملكيتك للحساب.
            </li>
            <li>
              سنؤكّد استلام الطلب وننفّذ الحذف خلال مدة لا تتجاوز{' '}
              <span className="font-bold text-brand-800">30 يومًا</span>، ونعلمك عند اكتماله.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">البيانات التي تُحذف</h2>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>اسمك وبريدك الإلكتروني وبيانات تسجيل الدخول (بما فيها كلمة المرور المشفّرة).</li>
            <li>رمز الإشعارات (Push Token) الخاص بجهازك.</li>
            <li>مفضّلاتك وتقييماتك المرتبطة بحسابك.</li>
            <li>ربط حسابك بتسجيل الدخول عبر Google (إن وُجد).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">بيانات قد تبقى</h2>
          <p className="text-muted">
            المواد التي ساهمت بها ونُشرت في الأرشيف قد تبقى محفوظة باعتبارها جزءًا من
            التراث العام المحفوظ، وتُفصل عن هويتك الشخصية عند الحذف. كما قد نحتفظ بحدٍّ
            أدنى من السجلّات إن تطلّب ذلك القانون، ولمدة لا تزيد على{' '}
            <span className="font-bold text-brand-800">90 يومًا</span> في النسخ الاحتياطية
            قبل إزالتها نهائيًا.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">حذف بيانات دون حذف الحساب</h2>
          <p className="text-muted">
            إن رغبت بحذف بيانات محدّدة فقط (مثل المفضّلة أو رمز الإشعارات) دون حذف
            حسابك بالكامل، اذكر ذلك في رسالتك وسننفّذه.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">للتواصل</h2>
          <p className="text-muted">
            لأي استفسار عن الحذف أو الخصوصية، راجع{' '}
            <Link href="/privacy" className="font-bold text-brand-700 underline">سياسة الخصوصية</Link>{' '}
            أو تواصل معنا عبر{' '}
            <Link href="/contact" className="font-bold text-brand-700 underline">صفحة «تواصل معنا»</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
