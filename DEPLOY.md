# نشر تجريبي على Railway

الموقع: **https://railway.com** (سابقاً railway.app)

## الخطوات بالترتيب

1. افتح https://railway.com واضغط **Login** → **Login with GitHub** ووافق على الصلاحيات.
2. اضغط **New Project** → **Deploy from GitHub repo**.
3. اختر مستودع **`Mohamed-albadri-1995/Almaseed`**.
   - إن طلب اختيار فرع (Branch)، اختر الفرع الذي يحتوي الكود.
4. سيبدأ Railway البناء تلقائياً (يقرأ ملف `railway.json`). انتظر حتى ينتهي.
5. **أضف قرصاً دائماً (Volume):** داخل الخدمة → تبويب **Variables/Settings** → **Volumes**
   → **New Volume** → **Mount path:** `/data`.
6. **أضف متغيّرات البيئة** (تبويب **Variables**):
   | المتغيّر | القيمة |
   |---|---|
   | `AUTH_SECRET` | أي نص عشوائي طويل (مثلاً 40 حرفاً) |
   | `DATABASE_URL` | `file:/data/dev.db` |
   | `UPLOADS_DIR` | `/data/uploads` |
7. **افتح رابطاً عاماً:** تبويب **Settings** → **Networking** → **Generate Domain**.
   ستحصل على رابط مثل `https://almaseed-production.up.railway.app`.
8. افتح الرابط. سجّل الدخول بحساب تجريبي:
   - `admin@almaseed.app` / `password123` (مدير النظام — يرى لوحة الإشراف)
   - `contributor@almaseed.app` / `password123` (مساهم — يرسل مادة)

## ملاحظات
- البيانات (قاعدة SQLite والملفات المرفوعة) محفوظة على القرص `/data` وتبقى بعد إعادة التشغيل.
- عند كل نشر جديد يُشغّل `npm run start:prod` الذي يهيّئ القاعدة ويزرع البيانات التجريبية إن كانت فارغة.
- التكلفة: هناك رصيد تجريبي مجاني، ثم اشتراك بسيط بالاستخدام.
