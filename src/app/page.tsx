import Link from 'next/link';
import { Icon } from '@/components/icons';
import { CategoryCard } from '@/components/CategoryCard';
import { MaterialCard } from '@/components/MaterialCard';
import {
  getCategoriesWithCounts,
  getHomeStats,
  getLatestPublished,
  getMostPlayed,
} from '@/lib/queries';
import { formatCount } from '@/lib/format';

export default async function HomePage() {
  const [categories, stats, latest, mostPlayed] = await Promise.all([
    getCategoriesWithCounts(),
    getHomeStats(),
    getLatestPublished(8),
    getMostPlayed(4),
  ]);

  const statCards = [
    { label: 'إجمالي المواد', value: stats.published },
    { label: 'التصنيفات', value: categories.length },
    { label: 'المساهمون', value: stats.contributors },
    { label: 'مرات التحميل', value: stats.downloads },
  ];

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden bg-brand-800 text-ivory-50">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full border border-gold-400/30" />
          <div className="absolute right-10 top-24 h-96 w-96 rounded-full border border-gold-400/20" />
        </div>
        <div className="container-page relative py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-gold-300">
              <Icon.sparkle width={16} height={16} />
              من ذاكرة المسيد
            </p>
            <h1 className="font-display mt-4 text-4xl leading-tight sm:text-6xl">
              <span className="text-ivory-50">صوتٌ يُحفظ،</span>{' '}
              <span className="text-gold-300">وأثرٌ لا يغيب.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-ivory-100/85 sm:text-lg">
              أرشيف مفتوح للمدائح والمحاضرات والندوات والمواعظ والمناسبات، نجمع فيه
              ما يستحق أن يبقى قريباً من القلب.
            </p>

            {/* Search */}
            <form action="/search" className="mx-auto mt-8 max-w-xl">
              <div className="flex items-center gap-2 rounded-2xl bg-ivory-50 p-2 shadow-lg">
                <span className="pr-2 text-muted">
                  <Icon.search width={20} height={20} />
                </span>
                <input
                  name="q"
                  type="search"
                  placeholder="ابحث عن مدحة، مادح، محاضر، موضوع أو مناسبة…"
                  className="flex-1 bg-transparent px-1 py-2 text-sm text-ink outline-none placeholder:text-muted/70"
                  aria-label="بحث"
                />
                <button type="submit" className="btn-primary shrink-0">
                  بحث
                </button>
              </div>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/archive" className="btn-gold btn-lg">
                استكشف الأرشيف
                <Icon.arrowLeft width={18} height={18} />
              </Link>
              <Link href="/submit" className="btn-outline btn-lg border-ivory-100/40 text-ivory-50 hover:bg-white/10">
                ساهم في الحفظ
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Stats ---------------- */}
      <section className="container-page -mt-10 relative">
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-6 shadow-card ring-1 ring-black/5 sm:grid-cols-4 sm:gap-6">
          {statCards.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-brand-700 sm:text-3xl">
                {formatCount(s.value)}
              </div>
              <div className="mt-1 text-xs text-muted sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Categories ---------------- */}
      <section className="container-page py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="eyebrow">أقسام الأرشيف</p>
            <h2 className="section-title mt-1">اختر باباً للدخول</h2>
          </div>
          <Link
            href="/archive"
            className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-500 sm:flex"
          >
            عرض كل الأقسام
            <Icon.chevronLeft width={16} height={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </section>

      {/* ---------------- Latest ---------------- */}
      <section className="bg-ivory-50 py-14">
        <div className="container-page">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow">وصل حديثاً</p>
              <h2 className="section-title mt-1">أحدث الإضافات</h2>
            </div>
            <Link
              href="/archive"
              className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-500"
            >
              كل المواد
              <Icon.chevronLeft width={16} height={16} />
            </Link>
          </div>
          {latest.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {latest.map((m) => (
                <MaterialCard key={m.id} material={m} />
              ))}
            </div>
          ) : (
            <p className="text-muted">لا توجد مواد منشورة بعد.</p>
          )}
        </div>
      </section>

      {/* ---------------- Most played ---------------- */}
      {mostPlayed.length > 0 && (
        <section className="container-page py-14">
          <div className="mb-8">
            <p className="eyebrow">الأكثر استماعاً</p>
            <h2 className="section-title mt-1">مواد يعود إليها الكثيرون</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mostPlayed.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Contribute CTA ---------------- */}
      <section className="container-page pb-16">
        <div className="overflow-hidden rounded-3xl bg-brand-700 px-6 py-12 text-center text-ivory-50 sm:px-12">
          <h2 className="font-display text-3xl text-ivory-50 sm:text-4xl">
            هل تملك تسجيلاً نافعاً؟
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ivory-100/85">
            ساهم في حفظه ونشره ليصل إلى الجميع. كل مادة تُراجَع من فريق الإشراف قبل
            نشرها حفاظاً على الجودة.
          </p>
          <Link href="/submit" className="btn-gold btn-lg mt-6">
            أرسل مادة للأرشيف
            <Icon.arrowLeft width={18} height={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
