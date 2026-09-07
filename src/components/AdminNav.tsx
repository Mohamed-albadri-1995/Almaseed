'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((it) => {
        const active =
          it.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(it.href);
        const IconCmp = (Icon as Record<string, (p: { width: number; height: number }) => JSX.Element>)[it.icon] ?? Icon.file;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-brand-700 text-ivory-50'
                : 'text-brand-700 hover:bg-brand-50'
            }`}
          >
            <IconCmp width={18} height={18} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
