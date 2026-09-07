# أرشيف المسيد — Al-Maseed Archive

منصة عربية مفتوحة لحفظ وتنظيم ونشر **المدائح، المحاضرات، الندوات، المواعظ،
والمناسبات**. يتصفّح الزوّار ويستمعون ويُنزّلون بحرية، ويساهم المسجّلون بموادّ
جديدة تمرّ بدورة مراجعة قبل نشرها.

> صوتٌ يُحفظ، وأثرٌ لا يغيب.

A full‑stack, right‑to‑left Arabic web app built with **Next.js 14 (App Router)**,
**TypeScript**, **Tailwind CSS**, **Prisma**, and **SQLite**.

---

## المزايا الرئيسية

**للزوّار والمساهمين**
- صفحة رئيسية بتصنيفات وأحدث الإضافات وإحصاءات حيّة.
- أرشيف بفلاتر (التصنيف، نوع الملف، المدينة، المادح/المحاضر) وفرز وترقيم صفحات.
- صفحة تفاصيل المادة مع مشغّل صوت/فيديو، تنزيل، مشاركة، مفضلة، ومواد ذات صلة.
- بحث في العنوان والمادح والمحاضر والموضوع والمناسبة والكلمات المفتاحية.
- إرسال مادة عبر نموذج متعدّد الخطوات مع رفع ملفات، وإقرار الحقوق والمراجعة.
- صفحة «حسابي»: حالة كل مادة (قيد المراجعة/منشورة/تحتاج تعديل/مرفوضة)،
  المفضلة، الإشعارات، وتعديل وإعادة إرسال المواد المرتجعة.
- الإبلاغ عن مشكلة في أي محتوى.

**للمشرفين (لوحة الإشراف `/admin`)**
- لوحة تحكم بإحصاءات المراجعة.
- قائمة الإرسالات مع تبويب حسب الحالة.
- صفحة مراجعة: معاينة الملف، تعديل البيانات، وقرارات (موافقة ونشر / طلب تعديل /
  رفض / حفظ كمسودة) مع سبب إلزامي وسجل مراجعة.
- إدارة المواد المنشورة (تعديل، إخفاء/إظهار).
- التقارير والبلاغات وسجل النشاط.
- إدارة المستخدمين والأدوار (لمدير النظام).

**الصلاحيات (RBAC)**: مساهم · مراجع · محرر · مدير محتوى · مدير النظام.

---

## التشغيل محلياً

المتطلبات: Node.js 18+.

```bash
npm install            # يثبّت الحزم ويولّد Prisma client
npm run db:push        # ينشئ قاعدة SQLite من المخطط
npm run db:seed        # يزرع تصنيفات ومستخدمين ومواد تجريبية
npm run dev            # http://localhost:3000
```

للإنتاج:

```bash
npm run build
npm start
```

### حسابات تجريبية (كلمة المرور `password123`)

| البريد | الدور |
|---|---|
| `admin@almaseed.app` | مدير النظام |
| `manager@almaseed.app` | مدير محتوى |
| `editor@almaseed.app` | محرر |
| `reviewer@almaseed.app` | مراجع |
| `contributor@almaseed.app` | مساهم |

---

## البنية التقنية

```
prisma/
  schema.prisma      # النماذج: User, Category, Material, ReviewNote,
                     # Favorite, Notification, ContentReport, ActivityLog
  seed.ts            # بيانات أولية
src/
  app/
    (public pages)   # /, /archive, /material/[id], /search, /submit,
                     # /login, /register, /account, /about, /faq, /contact, /policy
    admin/           # لوحة الإشراف (layout يحرس الصلاحيات)
    api/             # upload, materials/[id]/download
    *-actions.ts     # Server Actions (auth, submit, review, favorites…)
  components/        # Navbar, Footer, MaterialCard, MediaPlayer, forms…
  lib/               # prisma, session (JWT cookie), auth (bcrypt), rbac,
                     # constants, queries, format, validation, activity
```

### ملاحظات
- **قاعدة البيانات**: SQLite افتراضياً. للانتقال إلى PostgreSQL غيّر `provider`
  في `prisma/schema.prisma` و`DATABASE_URL` في `.env`. (القيم شبه‑التعدادية
  مخزّنة كنصوص لأن SQLite لا يدعم enums في Prisma — انظر `src/lib/constants.ts`.)
- **المصادقة**: جلسة عبر كوكي JWT موقّع (`jose`) وكلمات مرور مُجزّأة (`bcryptjs`).
- **الرفع**: الملفات تُحفظ في `public/uploads/` (غير متتبّعة في git). في الإنتاج
  استخدم تخزيناً سحابياً.
- دورة النشر: إرسال → قيد المراجعة → (نشر / طلب تعديل / رفض)، ولا تظهر المادة في
  النتائج العامة إلا بعد اعتمادها.

### متغيّرات البيئة (`.env`)
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<long-random-string>"
```
