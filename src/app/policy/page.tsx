import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'السياسات وشروط النشر',
  description: 'سياسات وشروط النشر والمساهمة في أرشيف الطريقة السمّانية السجادة السليمانية، وحقوق المواد وآلية المراجعة.',
  alternates: { canonical: '/policy' },
};

export default function PolicyPage() {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl space-y-10 leading-8 text-ink/90 [&>section]:scroll-mt-24">
        <div>
          <p className="eyebrow">الشفافية أولاً</p>
          <h1 className="section-title mt-1">السياسات وشروط النشر</h1>
          <p className="mt-2 text-muted">
            هذه الصفحة تجمع كل ما يخصّ المساهمة والمراجعة والنشر والحذف والخصوصية في
            أرشيف المسيد، بصورة مفصّلة وواضحة.
          </p>
        </div>

        <nav aria-label="محتويات الصفحة" className="rounded-2xl border border-ivory-300 bg-white p-5">
          <p className="mb-3 font-bold text-brand-800">محتويات الصفحة</p>
          <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {[
              ['#goal', 'الهدف'],
              ['#automation', 'نظامٌ آليٌّ عادل'],
              ['#archive-policy', 'سياسة الأرشفة والحفظ'],
              ['#types', 'الأنواع المقبولة في كل قسم'],
              ['#roles', 'الأدوار في الأرشيف'],
              ['#review-policy', 'مراجعة المواد'],
              ['#deletion-policy', 'حذف المواد'],
              ['#publishing', 'شروط نشر المحتوى'],
              ['#usage', 'سياسة الاستخدام'],
              ['#privacy', 'سياسة الخصوصية'],
              ['#rights', 'الحقوق والإبلاغ'],
              ['#updates', 'تحديثات السياسة'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-brand-700 hover:underline">{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="goal" className="rounded-2xl border-r-4 border-gold-300 bg-brand-50/60 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold text-brand-800">الهدف</h2>
          <p className="mt-2 text-muted">
            نريد أن يصبح هذا الأرشيف، مع مرور الوقت، ذاكرة رقمية للمسيد؛ يجمع ما تفرّق من
            مواده ووثائقه وتسجيلاته وصوره، ويحفظها بطريقة تجعل الوصول إليها ممكنًا اليوم
            وبعد سنوات طويلة. ولتحقيق ذلك وضعنا السياسات وشروط النشر التالية.
          </p>
        </section>

        <section id="automation" className="rounded-2xl border-2 border-gold-300 bg-gold-50 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold text-brand-800">نظامٌ آليٌّ عادل</h2>
          <p className="mt-2 text-muted">
            تُدار المراجعة والنشر والحذف في هذا الأرشيف عبر
            {' '}<span className="font-bold text-brand-800">نظامٍ آليّ</span> يطبّق القواعد المنشورة
            هنا بنفسه، بدقّةٍ وبلا محاباة: يَعُدّ أصوات المراجعين، ويُعلّق المواد، ويحسب المُدد
            (كمهلة الأسبوع)، ويُرسل الإشعارات، ثم يَنشر أو يَحذف عند اكتمال الشروط — كلّه
            {' '}<span className="font-bold text-brand-800">آليًّا ودون تدخّل يدوي</span>.
          </p>
          <p className="mt-2 text-muted">
            ولا يملك <span className="font-bold text-brand-800">أيُّ شخصٍ بمفرده</span> — ولا مدير
            النظام — الانفرادَ بالقرار أو تجاوزَ هذه القواعد؛ فالكلمة للنظام وفق ما هو مكتوب في
            هذه الصفحة، ضمانًا للعدل وحفظًا للأمانة.
          </p>
        </section>

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

        <section id="types" className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">الأنواع المقبولة في كل قسم</h2>
          <p className="text-muted">
            يقبل كل قسم أنواعًا محدّدة من الملفات؛ حفاظًا على جودة الأرشيف وتناسقه:
          </p>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>
              <span className="font-bold text-brand-800">المدائح والمحاضرات والمواعظ والندوات والمناسبات:</span>{' '}
              ملفات <span className="font-bold text-brand-800">صوت أو فيديو فقط</span> (مع إمكانية
              التسجيل المباشر من الكاميرا أو الميكروفون داخل التطبيق).
            </li>
            <li>
              <span className="font-bold text-brand-800">الصور:</span> ملفات صور فقط (JPG، PNG، WEBP).
            </li>
            <li>
              <span className="font-bold text-brand-800">مكتبة المسيد:</span> مقال يُكتب داخل الموقع،
              أو ملف مرفق (وثيقة، كتاب، صوت، فيديو…) — وهي الأوسع نوعًا.
            </li>
          </ul>
          <p className="text-sm text-muted">أقصى حجم للملف الواحد: ٢٠٠ ميجابايت.</p>
        </section>

        <section id="roles" className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">الأدوار في الأرشيف</h2>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>
              <span className="font-bold text-brand-800">الزائر:</span> يتصفّح ويستمع ويشاهد ويُنزّل كل
              المحتوى المنشور <span className="font-bold text-brand-800">دون حساب</span>.
            </li>
            <li>
              <span className="font-bold text-brand-800">المساهم:</span> يرسل المواد ويتابع حالتها في
              صفحة «حسابي»، وتصله الإشعارات بقرار كل مادة.
            </li>
            <li>
              <span className="font-bold text-brand-800">المراجع:</span> يراجع مواد قسمه فينشر أو يطلب
              تعديلًا أو يرفض، ويشارك في تصويت الحذف.
            </li>
            <li>
              <span className="font-bold text-brand-800">مدير النظام:</span> يدير الإعدادات والحسابات،
              ولا يحذف مادةً إلا بطلب صاحبها أو لمشكلة تقنية.
            </li>
          </ul>
          <p className="text-sm text-muted">
            وتبقى القرارات المصيرية (النشر، التعليق، الحذف) بيد{' '}
            <a href="#automation" className="font-semibold text-brand-700 underline">النظام الآليّ</a>{' '}
            وفق القواعد المنشورة، لا بيد فردٍ واحد.
          </p>
        </section>

        <section id="review-policy" className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">مراجعة المواد</h2>
          <p className="text-muted">
            تُراجَع كل مادة مضافة قبل نشرها من قِبل مراجعي القسم المختصّين. ويتحقّق
            المراجع من:
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
          <div className="rounded-xl border-r-4 border-gold-300 bg-brand-50/60 p-4">
            <p className="font-bold text-brand-800">لا يراجع المراجع مادته</p>
            <p className="mt-2 text-muted">
              تفاديًا لتضارب المصالح، إذا رفع المراجع (أو المشرف) مادةً بنفسه فلا يجوز له
              الموافقة عليها أو اتّخاذ أيّ قرار بشأنها؛ بل يراجعها مراجعٌ آخر من القسم.
              ويمنع النظام ذلك آليًّا.
            </p>
          </div>
          <div className="rounded-xl border-r-4 border-gold-300 bg-brand-50/60 p-4">
            <p className="font-bold text-brand-800">الرفض لا يكون بقرار مراجع واحد</p>
            <ul className="mt-2 list-disc space-y-2 pr-6 text-muted">
              <li>
                إذا رفض مراجعٌ مادةً، فإنها <span className="font-bold text-brand-800">تُعلَّق</span> ولا
                تُرفض، حتى يؤيّد الرفضَ <span className="font-bold text-brand-800">مراجعٌ ثانٍ</span>.
              </li>
              <li>
                فإن رفضها <span className="font-bold text-brand-800">مراجعان مختلفان</span> حُذفت
                نهائيًّا من الأرشيف.
              </li>
              <li>
                وإن مرّت <span className="font-bold text-brand-800">سبعة أيام</span> دون أن يؤيّد الرفضَ
                مراجعٌ آخر، <span className="font-bold text-brand-800">تُنشر المادة تلقائيًّا</span>.
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted">
              تُنفَّذ هذه الخطوات كلّها <span className="font-bold text-brand-800">آليًّا</span> —
              التعليق، وإشعار بقية المراجعين، وحساب مهلة الأسبوع، والنشر أو الحذف — دون قرارٍ فرديّ.
            </p>
          </div>
          <p className="text-muted">
            ولا يعني وجود المادة في منصة أخرى أنها غير صالحة للأرشفة؛ فالغرض من الموقع هو
            حفظ تراث المسيد وجمعه في أرشيف واحد منظم ومستمر.
          </p>
        </section>

        <section id="deletion-policy" className="space-y-3">
          <h2 className="text-xl font-bold text-brand-800">حذف المواد من الأرشيف</h2>
          <p className="text-muted">
            الأصل في هذا الأرشيف <span className="font-bold text-brand-800">الحفظ لا الحذف</span>؛
            فإن كانت في المادة مشكلة يسيرة نصحّحها أو نُخفيها مؤقتًا بدل حذفها. أما الحذف
            النهائي فيخضع لضوابط تمنع التفرّد بالقرار:
          </p>
          <ul className="list-disc space-y-2 pr-6 text-muted">
            <li>
              يمكن لأي من مراجعي القسم أن يفتح
              <span className="font-bold text-brand-800"> تصويت حذف</span> مع بيان سببه.
            </li>
            <li>
              يُقرَّر الحذف بـ<span className="font-bold text-brand-800">أغلبية مراجعي القسم</span>
              {' '}(أكثر من النصف)، ويشمل التصويت جميع مراجعي القسم، بمن فيهم من وافق على
              المادة أول مرة. وصوت مقدّم الطلب يُحتسب موافقةً.
            </li>
            <li>
              عند <span className="font-bold text-brand-800">تعادل الأصوات (النصف)</span> تبقى
              المادة محفوظة. والرفض صوتٌ محسوب لا إلغاءً فوريًّا؛ فمتى تعذّر بلوغ الأغلبية
              أُغلق التصويت وبقيت المادة.
            </li>
            <li>
              <span className="font-bold text-brand-800">مدير النظام</span> لا يحذف مادةً
              مباشرةً إلا في حالتين: <span className="font-bold text-brand-800">بطلب من صاحب
              المادة</span>، أو <span className="font-bold text-brand-800">مشكلة تقنية</span> —
              حتى وإن كان يملك الصلاحية تقنيًّا — ويبقى ذلك موثّقًا في سجل النشاط.
            </li>
          </ul>
          <p className="text-sm text-muted">
            ويُدير النظام هذا كلَّه <span className="font-bold text-brand-800">آليًّا</span>: فتح
            التصويت، وعدّ الأصوات، وإغلاقه عند التعادل أو تعذّر الأغلبية، وتنفيذ الحذف عند
            اكتمال الشروط — فلا انفراد لأحدٍ بقرار الحذف.
          </p>
          <p className="text-muted">
            وإن كنت مساهمًا وتريد حذف مادة رفعتها، فتواصل معنا أو استخدم رابط «الإبلاغ عن
            مشكلة» في صفحة المادة.
          </p>
        </section>

        <section id="publishing">
          <h2 className="text-xl font-bold text-brand-800">شروط نشر المحتوى</h2>
          <ul className="mt-3 list-disc space-y-2 pr-6 text-muted">
            <li>أن يكون المحتوى نافعاً ومتوافقاً مع طبيعة الأرشيف العلمية والدينية.</li>
            <li>أن يملك المساهم حق مشاركة المادة، وألا تخالف حقوق الآخرين.</li>
            <li>أن تُكمل الحقول الإجبارية المعلّمة بنجمة حمراء <span className="font-bold text-danger">*</span>، وما تيسّر من الحقول الاختيارية يزيد المادة قيمة.</li>
            <li>أن تكون البيانات المرفقة صحيحة قدر الإمكان (المادح، المناسبة، التاريخ…).</li>
            <li>تخضع كل مادة للمراجعة قبل النشر، وقد يُطلب تعديلها أو تُرفض مع بيان السبب.</li>
            <li>بعد النشر تبقى المادة محفوظة، ولا تُحذف إلا وفق <a href="#deletion-policy" className="font-semibold text-brand-700 underline">سياسة حذف المواد</a>.</li>
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
            لا نطلب من الزائر أي بيانات للتصفّح أو التنزيل. وعند إنشاء حساب نحفظ الحد
            الأدنى اللازم — الاسم والبريد الإلكتروني (والهاتف إن أضفته) ورمز الإشعارات —
            لإدارة المساهمات وإرسال الإشعارات، ولا نبيع بياناتك ولا نستخدمها للإعلانات
            ولا نشاركها مع جهات خارجية لأغراض تسويقية. للتفاصيل الكاملة (البيانات التي
            نجمعها، ومزوّدو الخدمة) راجع{' '}
            <a href="/privacy" className="font-semibold text-brand-700 underline">سياسة الخصوصية الكاملة</a>،
            {' '}ولحذف حسابك وبياناتك راجع{' '}
            <a href="/delete-account" className="font-semibold text-brand-700 underline">صفحة حذف الحساب</a>.
          </p>
        </section>

        <section id="rights">
          <h2 className="text-xl font-bold text-brand-800">حقوق الاستخدام والإبلاغ</h2>
          <p className="mt-3 text-muted">
            إذا كنت صاحب حق في مادة منشورة وترى أنها نُشرت دون إذن، أو لاحظت مشكلة في أي
            محتوى، يمكنك استخدام رابط «الإبلاغ عن مشكلة» في صفحة المادة أو صفحة{' '}
            <a href="/contact" className="font-semibold text-brand-700 underline">«تواصل معنا»</a>،
            وسنراجع البلاغ ونتخذ الإجراء المناسب.
          </p>
        </section>

        <section id="updates" className="border-t border-ivory-300 pt-6">
          <h2 className="text-xl font-bold text-brand-800">تحديثات السياسة</h2>
          <p className="mt-3 text-muted">
            قد نُحدّث هذه السياسات من حينٍ لآخر لتطوير الأرشيف أو للامتثال للمتطلبات،
            وتسري النسخة المنشورة هنا فور نشرها. ولأي استفسار تواصل معنا عبر{' '}
            <a href="/contact" className="font-semibold text-brand-700 underline">«تواصل معنا»</a>.
          </p>
          <p className="mt-2 text-sm text-muted">آخر تحديث: سبتمبر ٢٠٢٦.</p>
        </section>
      </div>
    </div>
  );
}
