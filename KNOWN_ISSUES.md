# مسائل معروفة

## 1) خطأ «تنزيل إلى الجهاز» للملفات الكبيرة — OutOfMemoryError ✅ (أُصلحت)
- **كان** مسار SAF يقرأ الملف كاملًا كنصّ Base64 عبر `readAsStringAsync` ثم يكتبه،
  فتنهار الذاكرة مع الملفات الكبيرة.
- **الإصلاح (BUILD 65):** استبدال ذلك بنسخ أصلي متدفّق عبر
  `StorageAccessFramework.copyAsync({ from, to })` (بلا تحميل في الذاكرة)، ومع
  الرجوع إلى مشاركة النظام (`Sharing.shareAsync`) إن تعذّر. لا مزيد من OutOfMemory.
