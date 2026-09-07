import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/icons';

export const metadata: Metadata = { title: 'عن الأرشيف' };

const VALUES = [
  { icon: 'archive' as const, title: 'حفظ دائم', body: 'نجمع المدائح والمحاضرات والندوات والمواعظ والمناسبات في مكان واحد يحميها من الضياع.' },
  { icon: 'check' as const, title: 'جودة مراجَعة', body: 'كل مادة تمر بدورة مراجعة قبل نشرها حفاظاً على دقة البيانات وسلامة المحتوى.' },
  { icon: 'users' as const, title: 'مساهمة مفتوحة', body: 'يستطيع الجميع المساهمة بمادة نافعة، والتصفّح والتنزيل متاحان دون قيود.' },
];

export default function AboutPage() {
  return (
    <div>
      <section className="bg-brand-800 py-16 text-ivory-50">
        <div className="container-page text-center">
          <p className="text-sm font-bold text-gold-300">عن المشروع</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">أرشيف المسيد</h1>
          <p className="mx-auto mt-4 max-w-2xl leading-8 text-ivory-100/85">
            منصة رقمية تهدف إلى حفظ ذاكرة المسيد الصوتية والمرئية، وتنظيمها وإتاحتها
            للجميع بطريقة سهلة ومحترمة تليق بطبيعة هذا المحتوى.
          </p>
        </div>
      </section>

      <div className="container-page py-14">
        <div className="grid gap-6 sm:grid-cols-3">
          {VALUES.map((v) => {
            const IconCmp = Icon[v.icon];
            return (
              <div key={v.title} className="card p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                  <IconCmp width={24} height={24} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-brand-800">{v.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{v.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-14 max-w-3xl space-y-6 text-ink/90">
          <div>
            <h2 className="text-xl font-bold text-brand-800">رسالتنا</h2>
            <p className="mt-2 leading-8">
              نؤمن أن ما قيل في مجالس العلم والإنشاد يستحق أن يبقى قريباً من القلب،
              وأن يصل إلى الأجيال القادمة. لذلك نعمل على توثيق هذا التراث رقمياً
              وإتاحته بأيسر الطرق.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-brand-800">كيف تساهم؟</h2>
            <p className="mt-2 leading-8">
              إن كنت تملك تسجيلاً نافعاً — مدحة، محاضرة، ندوة، موعظة أو توثيق مناسبة —
              يمكنك إرساله عبر صفحة «إرسال مادة»، وسيتولى فريق المراجعة فحصه قبل نشره.
            </p>
            <Link href="/submit" className="btn-primary mt-4">
              أرسل مادة للأرشيف
              <Icon.arrowLeft width={18} height={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
