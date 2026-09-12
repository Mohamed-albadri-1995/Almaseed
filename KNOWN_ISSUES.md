# مسائل معروفة (للإصلاح لاحقًا)

## 1) خطأ عند «تنزيل إلى الجهاز» للملفات الكبيرة — OutOfMemoryError
- **الظاهرة:** عند تنزيل ملف كبير إلى الجهاز يظهر:
  `Call to function 'ExponentFileSystem.readAsStringAsync' has been rejected.
   → java.lang.OutOfMemoryError: Failed to allocate a ~203MB allocation ...`
- **السبب:** في `mobile/App.js` دالة `saveViaSAF` تقرأ الملف كاملًا كنصّ Base64 عبر
  `FileSystem.readAsStringAsync(uri, { encoding: Base64 })` ثم تكتبه عبر Storage
  Access Framework. الملفات الكبيرة (صوت/فيديو) تتجاوز حدّ ذاكرة التطبيق فتنهار.
- **متى يظهر:** فقط في مسار SAF (غالبًا للمستندات، أو كبديل عند فشل حفظ الوسائط).
  «حفظ داخل التطبيق» (createDownloadResumable) و«حفظ في المعرض» (MediaLibrary)
  لا يتأثران بهذه المشكلة.
- **الإصلاح المقترح:** عدم قراءة الملف كاملًا في الذاكرة:
  - استخدام `StorageAccessFramework.copyAsync({ from, to })` إن توفّر، أو
  - النسخ على دفعات (streaming/chunked base64) بدل قراءة كل شيء دفعة واحدة، أو
  - الاكتفاء بـ MediaLibrary للوسائط وقصر SAF على الملفات الصغيرة/المستندات.
- **الأولوية:** متوسطة — يُصلَح في بناء لاحق قبل النشر العام.

_(سُجّلت بتاريخ 2026-09-12 — بناء 62 / SDK 54.)_
