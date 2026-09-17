// Data for the illustrated, step-by-step usage guide (/guide). Each flow is its
// own page so a reader can jump straight to the part they need instead of
// scrolling one long document. Screenshots live in /public/guide and every step
// points at the exact control (a blue ring is baked into each image).

export type BtnKind = 'primary' | 'gold' | 'outline' | 'approve' | 'reject' | 'edit';

export interface GuideStep {
  t: string;            // instruction (may contain <strong>)
  btn?: [string, BtnKind];
  shot?: string;        // /guide/xxx.png
  cap?: string;         // caption under the shot
}

export interface GuideFlow {
  id: string;
  group: 'contributor' | 'reviewer' | 'deletion';
  title: string;
  role: string;
  where: string;
  icon: string;         // emoji marker for the card
  steps: GuideStep[];
  result?: string;
  note?: string;
}

export const GUIDE_GROUPS: { id: GuideFlow['group']; title: string; desc: string }[] = [
  { id: 'contributor', title: 'للمساهمين', desc: 'إنشاء الحساب والدخول ورفع المواد ومتابعتها.' },
  { id: 'reviewer', title: 'للمراجعين', desc: 'مراجعة المواد بكل خياراتها ومقارنة التكرار والتثنية.' },
  { id: 'deletion', title: 'الحذف بالتصويت', desc: 'طلب حذف مادة والمشاركة في تصويت القسم.' },
];

export const GUIDE_FLOWS: GuideFlow[] = [
  {
    id: 'register', group: 'contributor', title: 'إنشاء حساب', role: 'زائر جديد', icon: '📝',
    where: 'القائمة ☰ ← تسجيل الدخول ← «إنشاء حساب»',
    steps: [
      { t: 'افتح القائمة <strong>☰</strong>، اختر <strong>«تسجيل الدخول»</strong>، ثم من صفحة الدخول اضغط رابط <strong>«إنشاء حساب»</strong>.', shot: '/guide/drawer_login.png', cap: 'من القائمة: زرّ «تسجيل الدخول» داخل الحلقة' },
      { t: 'اكتب <strong>الاسم</strong>.', shot: '/guide/s04_reg_name.png', cap: 'حقل الاسم داخل الحلقة' },
      { t: 'اكتب <strong>البريد الإلكتروني</strong>.', shot: '/guide/s05_reg_email.png', cap: 'حقل البريد داخل الحلقة' },
      { t: 'اكتب <strong>كلمة المرور</strong> (٦ أحرف على الأقل).', shot: '/guide/s06_reg_pass.png', cap: 'حقل كلمة المرور داخل الحلقة' },
      { t: 'فعّل مربّع <strong>«أوافق على شروط الاستخدام وسياسة النشر»</strong> — وهو إلزامي قبل الإنشاء.', shot: '/guide/s06b_reg_consent.png', cap: 'مربّع الموافقة داخل الحلقة' },
      { t: 'اضغط زرّ الإنشاء.', btn: ['إنشاء حساب', 'primary'], shot: '/guide/s07_reg_submit.png', cap: 'زرّ «إنشاء حساب» داخل الحلقة' },
    ],
    result: 'أصبح لديك حساب مساهم — يمكنك رفع المواد ومتابعة حالتها.',
  },
  {
    id: 'login', group: 'contributor', title: 'تسجيل الدخول', role: 'لكل مستخدم', icon: '🔑',
    where: 'القائمة ☰ ← تسجيل الدخول',
    steps: [
      { t: 'افتح القائمة <strong>☰</strong> واختر <strong>«تسجيل الدخول»</strong>.', btn: ['تسجيل الدخول', 'outline'], shot: '/guide/drawer_login.png', cap: 'زرّ «تسجيل الدخول» في القائمة داخل الحلقة' },
      { t: 'اكتب بريدك في حقل <strong>البريد الإلكتروني</strong>.', shot: '/guide/s08_login_email.png', cap: 'حقل البريد داخل الحلقة' },
      { t: 'اكتب كلمتك في حقل <strong>كلمة المرور</strong>.', shot: '/guide/s09_login_pass.png', cap: 'حقل كلمة المرور داخل الحلقة' },
      { t: 'اضغط زرّ الدخول (أخضر عريض).', btn: ['دخول', 'primary'], shot: '/guide/s10_login_submit.png', cap: 'زرّ «دخول» داخل الحلقة' },
    ],
    result: 'دخلت بنجاح — تظهر «حسابي»، و«لوحة الإشراف» لمن له صلاحية.',
  },
  {
    id: 'upload', group: 'contributor', title: 'رفع مادة جديدة', role: 'مساهم (بعد الدخول)', icon: '⬆️',
    where: 'زرّ «ساهم في الحفظ» / «أرسل مادة» ← صفحة الإرسال',
    steps: [
      { t: 'اضغط <strong>«ساهم في الحفظ»</strong> في الرئيسية (أو <strong>«أرسل مادة»</strong> من القائمة).', btn: ['أرسل مادة', 'gold'], shot: '/guide/s00_hero_submit.png', cap: 'زرّ الإرسال داخل الحلقة' },
      { t: '(اختياري) اطّلع على <strong>«مساعد المساهمين»</strong> أعلى النموذج.', shot: '/guide/s11_submit_helper.png', cap: 'بطاقة «مساعد المساهمين»' },
      { t: '<strong>الخطوة ١:</strong> اختر <strong>نوع المادة</strong> (مدائح، محاضرات، صور، مكتبة المسيد…).', shot: '/guide/s12_submit_category.png', cap: 'بطاقة نوع المادة داخل الحلقة' },
      { t: '<strong>الخطوة ٢:</strong> ارفع الملف — وفي «مكتبة المسيد» يمكنك اختيار <strong>«كتابة مقال»</strong> بدل الرفع.', shot: '/guide/s13_submit_articlemode.png', cap: 'زرّا «رفع ملف / كتابة مقال»' },
      { t: 'أكمل المحتوى (اختيار الملف أو كتابة النص).', shot: '/guide/s14_submit_articletext.png', cap: 'منطقة المحتوى داخل الحلقة' },
      { t: 'اضغط <strong>«التالي»</strong>.', btn: ['التالي', 'primary'], shot: '/guide/s15_submit_next2.png', cap: 'زرّ «التالي» داخل الحلقة' },
      { t: '<strong>الخطوة ٣:</strong> املأ <strong>العنوان *</strong> والحقول المفيدة، ثم اضغط <strong>«التالي»</strong>.', shot: '/guide/s16_submit_title.png', cap: 'حقل العنوان داخل الحلقة' },
      { t: '<strong>الخطوة ٤:</strong> فعّل <strong>مربّعَي الإقرار</strong>.', shot: '/guide/s18_submit_consent.png', cap: 'مربّع الإقرار داخل الحلقة' },
      { t: 'اضغط <strong>«إرسال للمراجعة»</strong>.', btn: ['إرسال للمراجعة', 'primary'], shot: '/guide/s19_submit_send.png', cap: 'زرّ «إرسال للمراجعة» داخل الحلقة' },
    ],
    result: 'وصلت مادتك للمراجعة، وتتابع حالتها في صفحة «حسابي» — ويصلك إشعار عند القبول أو طلب التعديل أو الرفض.',
  },
  {
    id: 'shareapp', group: 'contributor', title: 'المشاركة إلى التطبيق', role: 'مساهم (تطبيق أندرويد)', icon: '📲',
    where: 'أي تطبيق (المعرض/الملفات/مشغّل الصوت) ← مشاركة ← «أرشيف المسيد»',
    steps: [
      { t: 'في <strong>المعرض</strong> أو <strong>مدير الملفات</strong> أو <strong>مشغّل الصوت</strong>، اختر الملف (صوت أو فيديو أو صورة) واضغط <strong>«مشاركة»</strong>.', shot: '/guide/share_player.png', cap: 'زرّ «مشاركة» داخل الحلقة' },
      { t: 'اختر <strong>«أرشيف المسيد»</strong> من قائمة المشاركة في أندرويد.', shot: '/guide/share_pick.png', cap: '«أرشيف المسيد» في قائمة المشاركة داخل الحلقة' },
      { t: 'يفتح التطبيق على شاشة الإرسال والملف <strong>مُرفَق تلقائيًا</strong> — اختر <strong>القسم</strong> المناسب.', shot: '/guide/share_attach.png', cap: 'الملف مُرفَق، واختيار القسم داخل الحلقة' },
      { t: 'املأ <strong>الحقول الإلزامية</strong> (تتغيّر حسب القسم، وهي مطابقة تمامًا لنموذج الموقع).', shot: '/guide/share_fields.png', cap: 'حقل العنوان والحقول داخل الحلقة' },
      { t: 'علّم <strong>مربّعَي الإقرار</strong>، ثم اضغط <strong>«إرسال للمراجعة»</strong>.', btn: ['إرسال للمراجعة', 'primary'], shot: '/guide/share_send.png', cap: 'مربّعا الإقرار وزرّ «إرسال للمراجعة» داخل الحلقة' },
    ],
    result: 'تدخل مادتك مباشرةً إلى قائمة المراجعة — دون فتح صفحة الإرسال يدويًا.',
    note: 'تتطلّب تسجيل الدخول في التطبيق أولًا. متاحة في تطبيق أندرويد (الإصدار ١٢٣ فأحدث). الحقول والتحقّق نفسها الموجودة في الموقع، فلا اختلاف في النتيجة.',
  },
  {
    id: 'reach', group: 'reviewer', title: 'الوصول إلى المراجعة', role: 'مراجع', icon: '🗂️',
    where: 'حسابي ← لوحة الإشراف ← المراجعة',
    steps: [
      { t: 'من حسابك اضغط <strong>«المراجعة»</strong> (الزرّ الأخضر).', btn: ['المراجعة', 'primary'], shot: '/guide/s20_dash_review.png', cap: 'زرّ «المراجعة» داخل الحلقة' },
      { t: 'اختر التبويب: <strong>قيد المراجعة</strong> للجديد، <strong>معلّقة</strong> لمنتظِر مراجعٍ ثانٍ…', shot: '/guide/s21_sub_tabs.png', cap: 'تبويبات الحالات داخل الحلقة' },
      { t: 'افتح المادة (اضغط عنوانها أو «مراجعة»).', shot: '/guide/s22_sub_open.png', cap: 'رابط فتح المادة داخل الحلقة' },
    ],
    result: 'تفتح صفحة المادة: المعاينة، مساعد المراجعة، مقارنة التكرار، وبطاقة القرار.',
    note: 'لا يمكنك مراجعة مادة أرسلتها بنفسك — يمنع النظام ذلك تفاديًا لتضارب المصالح، ويراجعها مراجعٌ آخر من القسم.',
  },
  {
    id: 'compare', group: 'reviewer', title: 'مقارنة التكرار', role: 'مراجع', icon: '🔍',
    where: 'صفحة مراجعة المادة',
    steps: [
      { t: 'يرصد <strong>«مساعد المراجعة»</strong> أي مادة قد تكون مطابِقة (الملف/الحجم/العنوان/المادح)، وفي بطاقة <strong>«مقارنة للتأكّد من عدم التكرار»</strong> تشغّل <strong>المادتين معًا</strong> جنبًا إلى جنب.', shot: '/guide/s29_rev_compare.png', cap: 'رصد «محتوى مشابه أو مكرّر»' },
    ],
    note: 'تؤكّد التكرار بالسمع/المشاهدة قبل القرار — لا بالعنوان وحده.',
  },
  {
    id: 'approve', group: 'reviewer', title: 'القبول والنشر', role: 'مراجع', icon: '✅',
    where: 'بطاقة «قرار المراجعة»',
    steps: [
      { t: 'اختر إجراء الموافقة (أخضر).', btn: ['موافقة ونشر', 'approve'], shot: '/guide/s23_rev_approve.png', cap: 'زرّ «موافقة ونشر» داخل الحلقة' },
      { t: 'ثبّت القرار.', btn: ['تأكيد القرار', 'primary'], shot: '/guide/s28_rev_confirm.png', cap: 'زرّ «تأكيد القرار» داخل الحلقة' },
    ],
    result: 'تُنشر المادة فورًا، ويصل إشعار للمساهم وإشعار للأجهزة المشتركة.',
  },
  {
    id: 'requestedit', group: 'reviewer', title: 'طلب تعديل', role: 'مراجع', icon: '✏️',
    where: 'بطاقة «قرار المراجعة»',
    steps: [
      { t: 'اختر إجراء طلب التعديل (أزرق).', btn: ['طلب تعديل', 'edit'], shot: '/guide/s24_rev_edit.png', cap: 'زرّ «طلب تعديل» داخل الحلقة' },
      { t: 'بعد الاختيار تظهر قائمة <strong>«السبب»</strong> — اخترها، واكتب <strong>ملاحظة</strong> توضّح المطلوب للمساهم.', shot: '/guide/s27_rev_note.png', cap: 'اختر السبب واكتب الملاحظة' },
      { t: 'ثبّت القرار.', btn: ['تأكيد القرار', 'primary'], shot: '/guide/s28_rev_confirm.png', cap: 'زرّ «تأكيد القرار» داخل الحلقة' },
    ],
    result: 'تصل المساهم كـ«تحتاج تعديل» مع سببك، فيصحّحها ويعيد إرسالها.',
  },
  {
    id: 'reject', group: 'reviewer', title: 'الرفض', role: 'مراجع', icon: '⛔',
    where: 'بطاقة «قرار المراجعة»',
    steps: [
      { t: 'اختر إجراء الرفض (أحمر).', btn: ['رفض المادة', 'reject'], shot: '/guide/s25_rev_reject.png', cap: 'زرّ «رفض المادة» داخل الحلقة' },
      { t: 'بعد الاختيار تظهر قائمة <strong>«السبب» (إلزامي)</strong> — اخترها، ويمكنك كتابة <strong>ملاحظة</strong> للمساهم.', shot: '/guide/s27_rev_note.png', cap: 'اختر السبب واكتب الملاحظة' },
      { t: 'ثبّت القرار.', btn: ['تأكيد القرار', 'primary'], shot: '/guide/s28_rev_confirm.png', cap: 'زرّ «تأكيد القرار» داخل الحلقة' },
    ],
    result: 'تصبح المادة «معلّقة» بانتظار مراجع ثانٍ — لا تُرفض بقرار فرد، ويصل بقية المراجعين إشعار على الجهاز.',
  },
  {
    id: 'second', group: 'reviewer', title: 'التثنية أو نقض الرفض', role: 'مراجع ثانٍ', icon: '⚖️',
    where: 'المراجعة ← تبويب «معلّقة»',
    steps: [
      { t: 'افتح تبويب <strong>«معلّقة»</strong> واختر المادة.', shot: '/guide/s21_sub_tabs.png', cap: 'تبويب «معلّقة»' },
      { t: '<strong>لإتمام الرفض:</strong> رفض ← السبب ← تأكيد — فتُحذف نهائيًّا.', btn: ['رفض المادة', 'reject'], shot: '/guide/s25_rev_reject.png', cap: 'زرّ «رفض المادة»' },
      { t: '<strong>لنقض الرفض:</strong> موافقة ← تأكيد — فتُنشر ويُلغى التعليق.', btn: ['موافقة ونشر', 'approve'], shot: '/guide/s23_rev_approve.png', cap: 'زرّ «موافقة ونشر»' },
    ],
    note: 'المراجع الأول لا يُحتسب مرّتين — يلزم شخصان مختلفان لإتمام الرفض. وإن لم يتدخّل مراجعٌ ثانٍ خلال ٧ أيام تُنشر المادة تلقائيًّا. ويصل الطرفين إشعارٌ على الجهاز.',
  },
  {
    id: 'delstart', group: 'deletion', title: 'بدء تصويت حذف', role: 'مراجع', icon: '🗳️',
    where: 'لوحة الإشراف ← إدارة المواد',
    steps: [
      { t: 'افتح <strong>إدارة المواد</strong>، واعثر على المادة، ثم افتح <strong>«طلب حذف (تصويت القسم)»</strong> واكتب السبب (اختياري)، وابدأ التصويت.', btn: ['فتح تصويت الحذف', 'reject'], shot: '/guide/s30_mat_delreq.png', cap: 'خيار «طلب الحذف» داخل الحلقة' },
    ],
    result: 'يبدأ التصويت، ويصل بقية مراجعي القسم إشعار «طلب حذف يحتاج تصويتك» على الجهاز.',
  },
  {
    id: 'delvote', group: 'deletion', title: 'المشاركة في تصويت الحذف', role: 'مراجع ثانٍ فأكثر', icon: '👍',
    where: 'إدارة المواد ← لوحة «تصويتات حذف مفتوحة»',
    steps: [
      { t: 'في لوحة <strong>«تصويتات حذف مفتوحة»</strong> أعلى الصفحة صوّت بالموافقة على الحذف (أو بالرفض للإبقاء).', btn: ['أوافق على الحذف', 'reject'], shot: '/guide/s31_mat_delvote.png', cap: 'زرّ «أوافق على الحذف» داخل الحلقة' },
    ],
    result: 'عند بلوغ أغلبية مراجعي القسم (أكثر من النصف) تُحذف؛ والتعادل يُبقيها. ويمكنك تغيير صوتك ما دام التصويت مفتوحًا.',
    note: 'مدير النظام لديه «حذف مباشر» بسببين فقط: بطلب صاحب المادة، أو مشكلة تقنية — ويُوثّق في السجل.',
  },
];

export function getGuideFlow(id: string): GuideFlow | undefined {
  return GUIDE_FLOWS.find((f) => f.id === id);
}
