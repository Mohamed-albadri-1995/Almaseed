import Link from 'next/link';
import { Icon } from '@/components/icons';
import { CategoryCard } from '@/components/CategoryCard';
import { MaterialCard } from '@/components/MaterialCard';
import { MediaCarousel } from '@/components/MediaCarousel';
import { SearchBox } from '@/components/SearchBox';
import {
  getCategoriesWithCounts,
  getHomeStats,
  getLatestPublished,
  getMediaShowcase,
  getMostPlayed,
} from '@/lib/queries';
import { formatCount } from '@/lib/format';

export default async function HomePage() {
  const [categories, stats, latest, mostPlayed, showcase] = await Promise.all([
    getCategoriesWithCounts(),
    getHomeStats(),
    getLatestPublished(8),
    getMostPlayed(4),
    getMediaShowcase(10),
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
      <section className="relative overflow-hidden bg-brand-900 text-ivory-50">
        {/* Cover banner (emblem + name + tagline are part of the artwork) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-banner.jpg"
          alt="الطريقة السمّانية — السجادة السليمانية · علم · ذكر · سلوك · نور"
          className="block h-auto w-full"
        />

        {/* Intro + search + actions */}
        <div className="border-t border-white/10 bg-brand-800">
          <div className="container-page py-10 text-center">
            <p className="font-display text-xl text-ivory-100/90 sm:text-2xl">
              صوتٌ يُحفظ، وأثرٌ لا يغيب.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-ivory-100/85 sm:text-lg">
              أرشيف مفتوح للمدائح والمحاضرات والندوات والمواعظ والمناسبات، نجمع فيه
              ما يستحق أن يبقى قريباً من القلب.
            </p>
            <div className="mx-auto mt-7 max-w-xl">
              <SearchBox />
            </div>
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

      {/* ---------------- Browse by type ---------------- */}
      <section className="container-page pb-4">
        <div className="mb-6">
          <p className="eyebrow">تصفّح حسب النوع</p>
          <h2 className="section-title mt-1">كل نوع في مكان واحد</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { kind: 'AUDIO', label: 'صوتيات', icon: 'headphones' },
            { kind: 'VIDEO', label: 'مرئيات', icon: 'video' },
            { kind: 'ARTICLE', label: 'مقالات', icon: 'edit' },
            { kind: 'DOCUMENT', label: 'وثائق', icon: 'file' },
            { kind: 'IMAGE', label: 'صور', icon: 'image' },
          ].map((t) => {
            const I = Icon[t.icon as keyof typeof Icon];
            return (
              <Link
                key={t.kind}
                href={`/archive?kind=${t.kind}`}
                className="group flex flex-col items-center gap-2 rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition hover:shadow-card-hover hover:ring-brand-200"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-ivory-50">
                  <I width={22} height={22} />
                </span>
                <span className="text-sm font-bold text-brand-800">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------------- Interactive media carousel ---------------- */}
      {showcase.length > 0 && <MediaCarousel items={showcase} />}

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
