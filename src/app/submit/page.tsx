import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitForm } from '@/components/SubmitForm';
import { Icon } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'إرسال مادة' };

export default async function SubmitPage() {
  const user = await getCurrentUser();
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="eyebrow">ساهم في الحفظ</p>
          <h1 className="section-title mt-1">إرسال مادة جديدة</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            شاركنا مادة نافعة لتُضاف إلى الأرشيف بعد مراجعتها. اختر النوع، أدخل البيانات، وأرفق الملف.
          </p>
        </div>

        {user ? (
          <div className="card p-6 sm:p-8">
            <SubmitForm categories={categories} />
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Icon.user width={28} height={28} />
            </span>
            <h2 className="text-lg font-bold text-brand-800">يلزم تسجيل الدخول للمساهمة</h2>
            <p className="max-w-sm text-sm text-muted">
              التصفّح والتنزيل متاحان للجميع، أما إرسال مادة ومتابعة حالتها فيتطلب حساباً.
            </p>
            <div className="flex gap-2">
              <Link href="/login?redirect=/submit" className="btn-primary">تسجيل الدخول</Link>
              <Link href="/register" className="btn-outline">إنشاء حساب</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
