import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'الأسئلة الشائعة' };

const FAQS = [
  {
    q: 'هل أحتاج إلى حساب للتصفّح والتنزيل؟',
    a: 'لا، التصفّح والاستماع والتنزيل متاحة للجميع دون تسجيل. الحساب مطلوب فقط عند إرسال مادة أو استخدام المفضلة ومتابعة الإرسالات.',
  },
  {
    q: 'كيف أرسل مادة إلى الأرشيف؟',
    a: 'سجّل الدخول ثم انتقل إلى صفحة «إرسال مادة»، اختر النوع، أدخل البيانات، وأرفق الملف. ستصل المادة إلى فريق المراجعة قبل نشرها.',
  },
  {
    q: 'متى تظهر مادتي بعد الإرسال؟',
    a: 'تظهر المادة في الأرشيف العام فور اعتمادها من مشرف. قد يطلب المشرف تعديلاً أو يرفض المادة مع توضيح السبب.',
  },
  {
    q: 'ماذا يحدث إذا طُلب مني تعديل المادة؟',
    a: 'ستجد ملاحظة المراجع في صفحة «حسابي»، مع زر لتعديل البيانات وإعادة الإرسال دون الحاجة إلى إدخال المادة من جديد.',
  },
  {
    q: 'كيف أبلّغ عن مشكلة في محتوى منشور؟',
    a: 'في صفحة تفاصيل أي مادة يوجد رابط «الإبلاغ عن مشكلة في المحتوى» لإرسال بلاغ إلى فريق الإشراف.',
  },
  {
    q: 'ما صيغ الملفات المدعومة؟',
    a: 'الصوت (MP3, WAV, M4A)، الفيديو (MP4, MOV, WEBM)، المستندات (PDF, DOC) والصور (JPG, PNG). الحد الأقصى لحجم الملف 200 ميجابايت.',
  },
];

export default function FaqPage() {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="eyebrow">مساعدة</p>
          <h1 className="section-title mt-1">الأسئلة الشائعة</h1>
        </div>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-bold text-brand-800">
                {f.q}
                <span className="text-gold-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-8 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
