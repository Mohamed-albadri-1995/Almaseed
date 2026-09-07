import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center py-24 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-400">
        <Icon.search width={38} height={38} />
      </span>
      <h1 className="mt-6 text-3xl font-extrabold text-brand-800">الصفحة أو الملف غير متاح</h1>
      <p className="mt-2 max-w-md text-muted">
        قد يكون الرابط غير صحيح، أو أن المادة لم تُنشر بعد أو تم إخفاؤها. جرّب البحث أو العودة إلى الأرشيف.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-primary">العودة للرئيسية</Link>
        <Link href="/archive" className="btn-outline">تصفّح الأرشيف</Link>
      </div>
    </div>
  );
}
