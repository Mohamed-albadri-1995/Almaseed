import Link from 'next/link';
import type { Metadata } from 'next';
import { MaterialCard } from '@/components/MaterialCard';
import { Pagination } from '@/components/Pagination';
import { Icon } from '@/components/icons';
import { SearchBox } from '@/components/SearchBox';
import { searchMaterials, getCategoriesWithCounts } from '@/lib/queries';
import { formatCount } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'البحث' };

const SUGGESTIONS = ['مدائح', 'مولد', 'محاضرة', 'ندوة', 'موعظة', 'التربية'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [result, categories] = await Promise.all([
    q ? searchMaterials({ q, page, perPage: 12 }) : Promise.resolve(null),
    getCategoriesWithCounts(),
  ]);

  return (
    <div>
      {/* Search hero */}
      <section className="bg-brand-800 py-12 text-ivory-50">
        <div className="container-page">
          <p className="text-center text-sm font-bold text-gold-300">اكتشف ما تبحث عنه</p>
          <h1 className="mt-2 text-center font-display text-3xl sm:text-4xl">
            كل ما قيل… محفوظ هنا
          </h1>
          <div className="mx-auto mt-6 max-w-2xl">
            <SearchBox defaultValue={q} autoFocus />
          </div>
          {!q && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Link
                  key={s}
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm text-ivory-100 hover:bg-white/20"
                >
                  {s}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="container-page py-10">
        {!q ? (
          <div>
            <h2 className="mb-6 text-lg font-bold text-brand-800">تصفّح حسب التصنيف</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/archive?category=${c.slug}`}
                  className="card flex items-center justify-between p-5 hover:shadow-card-hover"
                >
                  <div>
                    <p className="font-bold text-brand-800">{c.name}</p>
                    <p className="text-sm text-muted">{c.description}</p>
                  </div>
                  <span className="chip">{formatCount(c.count)}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : result && result.items.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted">
              {formatCount(result.total)} نتيجة عن «<span className="font-semibold text-brand-700">{q}</span>»
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((m) => (
                <MaterialCard key={m.id} material={m} />
              ))}
            </div>
            <Pagination
              page={result.page}
              pages={result.pages}
              makeHref={(p) => `/search?q=${encodeURIComponent(q)}&page=${p}`}
            />
          </>
        ) : (
          <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory-200 text-muted">
              <Icon.search width={26} height={26} />
            </span>
            <p className="text-lg font-semibold text-brand-800">
              لا توجد نتائج عن «{q}»
            </p>
            <p className="text-sm text-muted">جرّب كلمات أعم أو تصفّح التصنيفات التالية:</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <Link key={c.id} href={`/archive?category=${c.slug}`} className="chip">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
