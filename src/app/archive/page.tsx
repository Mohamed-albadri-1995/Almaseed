import Link from 'next/link';
import { MaterialCard } from '@/components/MaterialCard';
import { Pagination } from '@/components/Pagination';
import { Icon } from '@/components/icons';
import {
  getCategoriesWithCounts,
  getFilterFacets,
  searchMaterials,
} from '@/lib/queries';
import { FILE_KINDS, FILE_KIND_LABELS, SORT_OPTIONS, type FileKind } from '@/lib/constants';
import { formatCount } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface SearchParams {
  category?: string;
  q?: string;
  kind?: string;
  city?: string;
  person?: string;
  sort?: string;
  page?: string;
}

function buildQuery(base: SearchParams, override: Partial<SearchParams>) {
  const merged = { ...base, ...override };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) sp.set(k, String(v));
  }
  const s = sp.toString();
  return `/archive${s ? `?${s}` : ''}`;
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [categories, facets, result] = await Promise.all([
    getCategoriesWithCounts(),
    getFilterFacets(),
    searchMaterials({
      categorySlug: searchParams.category,
      q: searchParams.q,
      fileKind: searchParams.kind,
      city: searchParams.city,
      person: searchParams.person,
      sort: searchParams.sort,
      page,
    }),
  ]);

  const activeCat = categories.find((c) => c.slug === searchParams.category);
  const title = activeCat ? activeCat.name : 'الأرشيف';

  return (
    <div className="container-page py-10">
      {/* Header */}
      <div className="mb-6">
        <nav className="mb-2 flex items-center gap-1 text-sm text-muted">
          <Link href="/" className="hover:text-brand-600">الرئيسية</Link>
          <Icon.chevronLeft width={14} height={14} />
          <span className="text-brand-700">{title}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="section-title">{title}</h1>
            {activeCat?.description && (
              <p className="mt-1 text-muted">{activeCat.description}</p>
            )}
          </div>
          <p className="text-sm text-muted">
            {formatCount(result.total)} نتيجة
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside>
          <form
            method="get"
            className="card sticky top-20 space-y-5 p-5"
          >
            <div>
              <label className="label" htmlFor="q">البحث</label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={searchParams.q ?? ''}
                placeholder="كلمة مفتاحية…"
                className="input"
              />
            </div>

            <div>
              <p className="label">التصنيف</p>
              <div className="space-y-1">
                <Link
                  href={buildQuery(searchParams, { category: '', page: '' })}
                  className={`block rounded-lg px-3 py-1.5 text-sm ${
                    !searchParams.category
                      ? 'bg-brand-50 font-semibold text-brand-800'
                      : 'text-brand-700 hover:bg-ivory-100'
                  }`}
                >
                  الكل
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={buildQuery(searchParams, { category: c.slug, page: '' })}
                    className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                      searchParams.category === c.slug
                        ? 'bg-brand-50 font-semibold text-brand-800'
                        : 'text-brand-700 hover:bg-ivory-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-muted">{formatCount(c.count)}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="kind">نوع الملف</label>
              <select id="kind" name="kind" defaultValue={searchParams.kind ?? ''} className="input">
                <option value="">الكل</option>
                {Object.values(FILE_KINDS).map((k) => (
                  <option key={k} value={k}>{FILE_KIND_LABELS[k as FileKind]}</option>
                ))}
              </select>
            </div>

            {facets.cities.length > 0 && (
              <div>
                <label className="label" htmlFor="city">المدينة</label>
                <select id="city" name="city" defaultValue={searchParams.city ?? ''} className="input">
                  <option value="">الكل</option>
                  {facets.cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label" htmlFor="person">المادح / المحاضر</label>
              <input
                id="person"
                name="person"
                defaultValue={searchParams.person ?? ''}
                placeholder="الاسم…"
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="sort">الترتيب</label>
              <select id="sort" name="sort" defaultValue={searchParams.sort ?? 'newest'} className="input">
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* keep category on submit */}
            {searchParams.category && (
              <input type="hidden" name="category" value={searchParams.category} />
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">تطبيق</button>
              <Link href="/archive" className="btn-outline">مسح</Link>
            </div>
          </form>
        </aside>

        {/* Results */}
        <div>
          {result.items.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((m) => (
                  <MaterialCard key={m.id} material={m} />
                ))}
              </div>
              <Pagination
                page={result.page}
                pages={result.pages}
                makeHref={(p) => buildQuery(searchParams, { page: String(p) })}
              />
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center gap-3 p-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory-200 text-muted">
                <Icon.search width={26} height={26} />
              </span>
              <p className="text-lg font-semibold text-brand-800">لا توجد نتائج مطابقة</p>
              <p className="max-w-sm text-sm text-muted">
                جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر، أو تصفّح التصنيفات من القائمة الجانبية.
              </p>
              <Link href="/archive" className="btn-outline mt-2">إعادة ضبط الفلاتر</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
