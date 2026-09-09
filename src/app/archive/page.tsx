import Link from 'next/link';
import { MaterialCard } from '@/components/MaterialCard';
import { ImageGallery } from '@/components/ImageGallery';
import { Pagination } from '@/components/Pagination';
import { Icon } from '@/components/icons';
import {
  getCategoriesWithCounts,
  getFilterFacets,
  searchMaterials,
} from '@/lib/queries';
import { CONTENT_FORMS, SORT_OPTIONS } from '@/lib/constants';
import { getPrimaryPerson } from '@/lib/fields';
import { formatCount } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface SearchParams {
  category?: string;
  q?: string;
  kind?: string;
  city?: string;
  person?: string;
  occasion?: string;
  year?: string;
  language?: string;
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
  // المعرض: the الصور section is a gallery that aggregates EVERY image across all
  // sections, not just materials filed under it.
  const isGallery = searchParams.category === 'images';
  const [categories, facets, result] = await Promise.all([
    getCategoriesWithCounts(),
    getFilterFacets(),
    searchMaterials({
      categorySlug: isGallery ? undefined : searchParams.category,
      q: searchParams.q,
      fileKind: isGallery ? 'IMAGE' : searchParams.kind,
      city: searchParams.city,
      person: searchParams.person,
      occasion: searchParams.occasion,
      year: searchParams.year,
      language: searchParams.language,
      sort: searchParams.sort,
      page,
      perPage: isGallery ? 30 : undefined,
    }),
  ]);

  const activeCat = categories.find((c) => c.slug === searchParams.category);
  const title = activeCat ? activeCat.name : 'الأرشيف';

  // The person filter adapts to the selected type: choosing مديح shows «المادح»,
  // محاضرات shows «المحاضر», المكتبة shows «الكاتب», …. With no type chosen it
  // stays a broad name search across every person field.
  const primaryPerson = searchParams.category ? getPrimaryPerson(searchParams.category) : null;
  const personLabel = primaryPerson ? `اسم ${primaryPerson.label}` : 'المادح / المحاضر / الكاتب';

  // Only the facets that actually exist in the current content become filters.
  const extraFilters = [
    facets.cities.length > 0 && {
      name: 'city', label: 'المدينة', value: searchParams.city, options: facets.cities,
    },
    facets.years.length > 0 && {
      name: 'year', label: 'السنة', value: searchParams.year, options: facets.years,
    },
    facets.languages.length > 1 && {
      name: 'language', label: 'اللغة', value: searchParams.language, options: facets.languages,
    },
  ].filter(Boolean) as { name: string; label: string; value?: string; options: string[] }[];

  const advancedActive =
    !!searchParams.person || !!searchParams.occasion || extraFilters.some((f) => f.value);

  const kindLabel = CONTENT_FORMS.find((f) => f.value === searchParams.kind)?.label;
  const activeChips = [
    searchParams.q && { key: 'q', label: `بحث: ${searchParams.q}` },
    kindLabel && { key: 'kind', label: kindLabel },
    searchParams.city && { key: 'city', label: searchParams.city },
    searchParams.year && { key: 'year', label: searchParams.year },
    searchParams.language && { key: 'language', label: searchParams.language },
    searchParams.occasion && { key: 'occasion', label: `المناسبة: ${searchParams.occasion}` },
    searchParams.person && { key: 'person', label: `${personLabel}: ${searchParams.person}` },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="container-page py-8">
      {/* Compact header: breadcrumb + title + count */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-brand-600">الرئيسية</Link>
            <Icon.chevronLeft width={14} height={14} />
          </nav>
          <h1 className="text-xl font-bold text-brand-800 sm:text-2xl">{title}</h1>
        </div>
        <p className="text-sm text-muted">{formatCount(result.total)} {isGallery ? 'صورة' : 'نتيجة'}</p>
      </div>

      {isGallery && (
        <p className="mb-4 max-w-2xl text-sm leading-7 text-muted">
          معرض الصور — تُجمع فيه كل صور المسيد من جميع الأقسام في مكان واحد. اضغط أي صورة لعرضها بالحجم الكامل.
        </p>
      )}

      {/* Category chips (horizontal, scrollable) */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link
          href={buildQuery(searchParams, { category: '', page: '' })}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            !searchParams.category ? 'bg-brand-700 text-ivory-50' : 'bg-ivory-100 text-brand-700 hover:bg-ivory-200'
          }`}
        >
          الكل
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={buildQuery(searchParams, { category: c.slug, page: '' })}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              searchParams.category === c.slug ? 'bg-brand-700 text-ivory-50' : 'bg-ivory-100 text-brand-700 hover:bg-ivory-200'
            }`}
          >
            <span>{c.name}</span>
            <span className={`text-xs ${searchParams.category === c.slug ? 'text-ivory-100/70' : 'text-muted'}`}>
              {formatCount(c.count)}
            </span>
          </Link>
        ))}
      </div>

      {/* Content-type quick filters (hidden in the all-images gallery) */}
      {!isGallery && (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href={buildQuery(searchParams, { kind: '', page: '' })}
            className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition ${
              !searchParams.kind ? 'bg-gold-400 text-brand-900' : 'bg-white text-brand-700 ring-1 ring-ivory-300 hover:bg-ivory-100'
            }`}
          >
            كل الأنواع
          </Link>
          {CONTENT_FORMS.map((f) => (
            <Link
              key={f.value}
              href={buildQuery(searchParams, { kind: f.value, page: '' })}
              className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition ${
                searchParams.kind === f.value ? 'bg-gold-400 text-brand-900' : 'bg-white text-brand-700 ring-1 ring-ivory-300 hover:bg-ivory-100'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      {/* Slim search + collapsible filters */}
      <form method="get" className="mb-6 rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/5">
        {searchParams.category && (
          <input type="hidden" name="category" value={searchParams.category} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
              <Icon.search width={16} height={16} />
            </span>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={searchParams.q ?? ''}
              placeholder="ابحث في العناوين والأسماء والكلمات المفتاحية…"
              className="w-full rounded-xl border border-ivory-300 bg-white py-2.5 pe-4 ps-9 text-sm text-ink placeholder:text-muted/70 focus:border-brand-400 focus:ring-0"
            />
          </div>
          <select
            name="sort"
            defaultValue={searchParams.sort ?? 'newest'}
            className="rounded-xl border border-ivory-300 bg-white px-3 py-2.5 text-sm text-brand-800 focus:border-brand-400 focus:ring-0"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">تطبيق</button>
          {(advancedActive || searchParams.q) && (
            <Link href={buildQuery({}, { category: searchParams.category })} className="btn-ghost text-sm">مسح</Link>
          )}
        </div>

        {/* Adaptive advanced filters — only shown facets that have data */}
        <details className="group mt-1" open={advancedActive}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-sm font-semibold text-brand-700">
            <Icon.chevronLeft width={14} height={14} className="transition-transform group-open:-rotate-90" />
            فلاتر متقدمة
            {advancedActive && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-700">مُفعّلة</span>}
          </summary>
          <div className="grid gap-3 px-2 pb-2 pt-1 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">نوع المحتوى</span>
              <select name="kind" defaultValue={searchParams.kind ?? ''} className="input">
                <option value="">الكل</option>
                {CONTENT_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            {extraFilters.map((f) => (
              <label key={f.name} className="block">
                <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
                <select name={f.name} defaultValue={f.value ?? ''} className="input">
                  <option value="">الكل</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{personLabel}</span>
              <input
                name="person"
                defaultValue={searchParams.person ?? ''}
                placeholder="الاسم…"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">المناسبة</span>
              <input
                name="occasion"
                defaultValue={searchParams.occasion ?? ''}
                placeholder="اسم المناسبة…"
                className="input"
              />
            </label>
          </div>
        </details>
      </form>

      {/* Active filter pills */}
      {activeChips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">المطبّقة:</span>
          {activeChips.map((c) => (
            <Link
              key={c.key}
              href={buildQuery(searchParams, { [c.key]: '', page: '' })}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
            >
              <span>{c.label}</span>
              <span className="text-brand-500">✕</span>
            </Link>
          ))}
          <Link
            href={buildQuery({}, { category: searchParams.category })}
            className="text-xs font-semibold text-danger hover:underline"
          >
            مسح الكل
          </Link>
        </div>
      )}

      {/* Results (full width) */}
      <div>
        {result.items.length ? (
            <>
              {searchParams.category === 'images' ? (
                <ImageGallery items={result.items} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {result.items.map((m) => (
                    <MaterialCard key={m.id} material={m} />
                  ))}
                </div>
              )}
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
                جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر، أو تصفّح التصنيفات من الشريط أعلى الصفحة.
              </p>
              <Link href="/archive" className="btn-outline mt-2">إعادة ضبط الفلاتر</Link>
            </div>
          )}
      </div>
    </div>
  );
}
