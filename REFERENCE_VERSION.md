# النسخة المرجعية المستقرة — أرشيف المسيد

هذه هي النسخة المرجعية المعتمدة (stable reference). عند حدوث أي خلل في نسخة
أحدث، نعود إلى هذه النقطة.

## التطبيق (Android) — النسخة المعتمدة على متجر Google Play ✅
- **BUILD: 111** — `versionCode` 111
- Commit: `00dd0cd` (ci(android): sign release AAB with the real upload key)
- بناء AAB/APK: GitHub Actions run **34742390313**
- **قُبِلت على Google Play (اختبار داخلي/دولي) وتعمل.**
- التوقيع: AAB موقّع بمفتاح الرفع الصحيح (SHA1 `A8:C3:B6:58:...:96:D1`).

### ما الذي تتضمّنه هذه النسخة (فوق مرجع بناء 58)
- **ترقية Expo SDK 54** (targetSdk 36) — متوافقة مع شروط النشر على Google Play.
  - الفيديو عبر `expo-video`، والصوت دون اتصال عبر `expo-audio` (حُذف expo-av).
  - `expo-file-system/legacy` للحفاظ على كود التنزيل، وdownload عبر MediaLibrary
    (بلا تجمّد/ANR).
  - `react-native-safe-area-context` — المشغّل المصغّر لا يختفي تحت شريط التنقّل.
- **اتجاه ثابت (LTR مفروض في MainApplication الأصلية):** لا تبديل بين مرّات الفتح،
  لا شاشة سوداء أول مرة، والنصوص العربية على اليمين بثبات في كل مرة.
- **زر «رجوع» في الجهة المطلوبة** (رأس مُعاد ترتيبه).
- **بناء وتوقيع الـAAB على GitHub Actions** من مفتاح الرفع (أسرار GitHub) —
  عبر `plugins/with-release-signing.js` + `mobile/ci-release-signing.gradle`
  الذي يُلحَق بـ`build.gradle` ليُجبر توقيع الإصدار بالمفتاح الصحيح.
- كل تحسينات مرجع بناء 58 (بحث، اقتراحات، ختم، إشعارات… إلخ).

## الخادم / الموقع
- Commit مرجعي للخادم: `d9710a5` (أحدث إصلاحات الخادم على هذا الفرع) — بلا تغيير.

## كيفية بناء نسخة موقّعة للمتجر (بلا EAS)
1. أسرار GitHub مضبوطة: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
2. شغّل workflow **Build Android APK** يدويًّا (Run workflow) على هذا الفرع.
3. حمّل `almaseed-aab` من Artifacts وارفعه على Play.

## للرجوع إلى هذه النسخة
```
git checkout -B claude/website-app-version-audit-1rdtdj 00dd0cd   # التطبيق (بناء 111)
# أو للخادم فقط أعد نشر Railway من d9710a5
```
> ملاحظة: أرقام البناء الأحدث تُبنى فوق هذه النسخة؛ إن ظهر خلل نعود إلى BUILD 111.

## المراجع الأقدم (احتياطية)
- BUILD 58 — `versionCode` 57 — Commit `97ca602` — SDK 51 (قبل توافق المتجر).
- BUILD 50 — `versionCode` 49 — Commit `bf17105` — خادم `faa52a6`.
