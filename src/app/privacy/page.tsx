import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية — تطبيق أرشيف المسيد',
  description:
    'سياسة خصوصية تطبيق الطريقة السمّانية — السجادة السليمانية: ما البيانات التي نجمعها، ولماذا، وكيف نحميها.',
};

// Dedicated privacy policy for the Android app (required by Google Play). Kept at
// a stable URL: https://almaseeed.com/privacy
export default function PrivacyPage() {
  const updated = 'سبتمبر 2025';
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl space-y-8 leading-8 text-ink/90">
        <div>
          <p className="eyebrow">الخصوصية</p>
          <h1 className="section-title mt-1">سياسة الخصوصية</h1>
          <p className="mt-2 text-sm text-muted">
            تطبيق «الطريقة السمّانية — السجادة السليمانية» (أرشيف المسيد) · آخر تحديث: {updated}
          </p>
        </div>

        <section className="space-y-3">
          <p className="text-muted">
            نحترم خصوصيتك ونجمع الحد الأدنى من البيانات اللازمة لتشغيل التطبيق. يمكنك
            تصفّح الأرشيف وتشغيل المواد وتنزيلها <span className="font-bold text-brand-800">دون إنشاء حساب</span>.
            توضّح هذه السياسة البيانات التي نجمعها عند استخدام التطبيق، والغرض منها، وكيف نحميها.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">البيانات التي نجمعها</h2>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>
              <span className="font-bold text-brand-800">بيانات الحساب (اختيارية):</span>{' '}
              عند إنشاء حساب أو تسجيل الدخول نحفظ الاسم والبريد الإلكتروني، وكلمة المرور
              مخزّنة مشفّرة (hashed). تُستخدم لتسجيل الدخول وإدارة المساهمات.
            </li>
            <li>
              <span className="font-bold text-brand-800">تسجيل الدخول عبر Google (اختياري):</span>{' '}
              إذا اخترته، نستلم من Google بريدك الإلكتروني واسمك فقط لإنشاء حسابك أو الدخول
              إليه. لا نصل إلى أي بيانات أخرى في حساب Google.
            </li>
            <li>
              <span className="font-bold text-brand-800">رمز الإشعارات (Push Token):</span>{' '}
              لإرسال إشعارات المحتوى الجديد وإشعارات المراجعة للمشرفين، نسجّل رمز جهازك
              عبر Firebase Cloud Messaging. يمكنك إيقاف الإشعارات من إعدادات النظام.
            </li>
            <li>
              <span className="font-bold text-brand-800">تفاعلاتك:</span>{' '}
              المواد المفضّلة والتقييمات التي تضيفها مرتبطة بحسابك.
            </li>
            <li>
              <span className="font-bold text-brand-800">المحتوى الذي تساهم به:</span>{' '}
              الملفات والمعلومات التي ترفعها (للمساهمين) تُحفظ في الأرشيف بعد المراجعة.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">أذونات الجهاز</h2>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>
              <span className="font-bold text-brand-800">الكاميرا والميكروفون:</span>{' '}
              تُطلب فقط عند اختيار «تسجيل صوت/فيديو» أثناء المساهمة، ولا تُستخدم في غير ذلك.
            </li>
            <li>
              <span className="font-bold text-brand-800">الوسائط/الملفات:</span>{' '}
              لحفظ المواد التي تنزّلها إلى جهازك.
            </li>
            <li>
              <span className="font-bold text-brand-800">الإشعارات:</span>{' '}
              لإظهار إشعارات المحتوى الجديد.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">كيف نستخدم البيانات</h2>
          <p className="text-muted">
            نستخدم البيانات لتشغيل التطبيق فقط: تسجيل الدخول، إدارة المساهمات والمراجعة،
            إرسال الإشعارات، وحفظ مفضّلاتك وتقييماتك. <span className="font-bold text-brand-800">لا نبيع بياناتك</span>،
            ولا نستخدمها للإعلانات، ولا نشاركها مع جهات خارجية لأغراض تسويقية.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">مزوّدو الخدمة</h2>
          <p className="text-muted">
            نعتمد على خدمات موثوقة لتشغيل التطبيق فقط: <span className="font-bold text-brand-800">Google Firebase</span>{' '}
            (إرسال الإشعارات)، <span className="font-bold text-brand-800">Google</span> (خيار تسجيل الدخول)،
            وخدمات الاستضافة وتخزين الملفات التي يعمل عليها الموقع. تعالج هذه الخدمات
            البيانات نيابةً عنّا وفق سياساتها.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">الاحتفاظ بالبيانات وحذفها</h2>
          <p className="text-muted">
            نحتفظ ببيانات حسابك ما دام حسابك قائمًا. يمكنك طلب{' '}
            <span className="font-bold text-brand-800">حذف حسابك وبياناتك الشخصية</span> في أي وقت
            بالتواصل معنا، وسننفّذ الطلب خلال مدة معقولة. قد تبقى المواد المنشورة في الأرشيف
            باعتبارها جزءًا من التراث المحفوظ، ما لم يكن هناك سبب لإزالتها.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">الأطفال</h2>
          <p className="text-muted">
            التطبيق موجّه للجمهور العام ولا نجمع عن قصد بيانات من الأطفال.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">التواصل معنا</h2>
          <p className="text-muted">
            لأي استفسار عن الخصوصية أو لطلب حذف البيانات، تواصل معنا عبر{' '}
            <Link href="/contact" className="font-bold text-brand-700 underline">صفحة «تواصل معنا»</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
