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

        <section id="archive-policy" className="space-y-4">
          <h2 className="text-2xl font-extrabold text-brand-800">سياسة أرشفة وحفظ تراث المسيد</h2>
          <p className="text-muted">
            هذا الموقع أرشيف رقمي مخصص لحفظ وتوثيق تراث المسيد، وجمع مواده في مكان واحد
            بصورة منظمة، لتبقى محفوظة ومتاحة للأجيال القادمة وسهلة البحث والوصول. لذلك،
            وللحفاظ على قيمة هذا الأرشيف وجودته، يجب أن تلتزم جميع المواد المضافة بالقواعد
            التالية:
          </p>
          <ol className="list-decimal space-y-3 pr-6">
            <li>
              <span className="font-bold text-brand-800">الارتباط بالمسيد:</span>{' '}
              يجب أن تكون المادة مرتبطة بالمسيد أو بشيوخه وطلابه وأهله ومناسباته وأنشطته
              وتراثه العلمي والدعوي والثقافي.
            </li>
            <li>
              <span className="font-bold text-brand-800">لا ترفع المادة المكررة:</span>{' '}
              قبل إضافة أي مادة، تأكد من عدم وجودها في الأرشيف مسبقًا. إذا كانت موجودة،
              فلا حاجة إلى رفع نسخة أخرى منها.
            </li>
            <li>
              <span className="font-bold text-brand-800">حافظ على جودة مناسبة:</span>{' '}
              ارفع المادة بأفضل جودة عملية ومناسبة لحجمها، وتجنب الملفات ذات الأحجام
              الكبيرة دون فائدة حقيقية.
            </li>
            <li>
              <span className="font-bold text-brand-800">أكمل معلومات المادة:</span>{' '}
              كلما كانت المعلومات أكثر اكتمالًا، أصبحت قيمة المادة الأرشيفية أكبر. احرص
              على إضافة ما تعرفه من معلومات عن المادة، مثل عنوانها، تاريخها، مناسبتها،
              الأشخاص المرتبطين بها، ومصدرها.
            </li>
            <li>
              <span className="font-bold text-brand-800">اختر التصنيف الصحيح:</span>{' '}
              ضع المادة في القسم المناسب لها حتى يسهل العثور عليها مستقبلًا.
            </li>
          </ol>
        </section>

        <section id="review-policy" className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">مراجعة المواد</h2>
          <p className="text-muted">
            تُراجع المواد المضافة إلى الأرشيف من قِبل المشرفين المختصين بكل قسم. ويتحقق
            المشرف من:
          </p>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>ارتباط المادة بالمسيد.</li>
            <li>عدم تكرارها.</li>
            <li>صحة المعلومات المتوفرة عنها.</li>
            <li>اكتمال البيانات قدر الإمكان.</li>
            <li>وضعها في التصنيف المناسب.</li>
            <li>مناسبة الملف من حيث الجودة والحجم.</li>
          </ul>
          <p className="text-muted">
            إذا كانت المعلومات ناقصة، يمكن للمشرف استكمالها إذا كانت لديه معلومات موثوقة،
            أو إرسال طلب إلى صاحب المادة لاستكمالها أو تصحيحها.
          </p>
          <p className="text-muted">
            ولا يعني وجود المادة في منصة أخرى أنها غير صالحة للأرشفة؛ فالغرض من الموقع هو
            حفظ تراث المسيد وجمعه في أرشيف واحد منظم ومستمر.
          </p>
        </section>

        <section id="goal" className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">الهدف</h2>
          <p className="text-muted">
            نريد أن يصبح هذا الأرشيف، مع مرور الوقت، ذاكرة رقمية للمسيد؛ يجمع ما تفرق من
            مواده ووثائقه وتسجيلاته وصوره، ويحفظها بطريقة تجعل الوصول إليها ممكنًا اليوم
            وبعد سنوات طويلة.
          </p>
        </section>

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
