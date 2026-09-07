import Link from 'next/link';
import { DynamicIcon, Icon } from './icons';
import { formatCount } from '@/lib/format';

const COLOR_MAP: Record<string, string> = {
  gold: 'from-gold-100 to-gold-200 text-gold-700',
  brand: 'from-brand-100 to-brand-200 text-brand-700',
  rose: 'from-rose-100 to-rose-200 text-rose-700',
  sky: 'from-sky-100 to-sky-200 text-sky-700',
  violet: 'from-violet-100 to-violet-200 text-violet-700',
};

export interface CategoryCardData {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  count: number;
}

export function CategoryCard({ category }: { category: CategoryCardData }) {
  const color = COLOR_MAP[category.color ?? 'brand'] ?? COLOR_MAP.brand;
  return (
    <Link
      href={`/archive?category=${category.slug}`}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${color} p-6 shadow-card ring-1 ring-black/5 transition hover:shadow-card-hover`}
    >
      <div className="flex items-start justify-between">
        <span className="text-brand-700/70 transition group-hover:-translate-y-0.5 group-hover:text-brand-700">
          <Icon.arrowLeft width={22} height={22} />
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 shadow-sm">
          <DynamicIcon name={category.icon} width={24} height={24} />
        </span>
      </div>
      <div className="mt-8 text-right">
        <h3 className="text-2xl font-extrabold text-brand-800">{category.name}</h3>
        {category.description && (
          <p className="mt-1 text-sm text-brand-700/80">{category.description}</p>
        )}
        <p className="mt-3 text-sm font-semibold text-brand-700/70">
          {formatCount(category.count)} مادة
        </p>
      </div>
    </Link>
  );
}
