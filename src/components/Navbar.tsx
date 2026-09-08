'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './icons';
import { LogoLockup } from './Logo';
import { isStaff } from '@/lib/rbac';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { logoutAction } from '@/app/auth-actions';

const NAV_LINKS = [
  { href: '/', label: 'الرئيسية' },
  { href: '/archive', label: 'الأرشيف' },
  { href: '/archive?category=madeeh', label: 'المدائح' },
  { href: '/archive?category=lectures', label: 'المحاضرات' },
  { href: '/archive?category=seminars', label: 'الندوات' },
  { href: '/archive?category=sermons', label: 'المواعظ' },
  { href: '/archive?category=occasions', label: 'المناسبات' },
  { href: '/about', label: 'عن الطريقة' },
];

interface NavUser {
  name: string;
  role: string;
  email: string;
  unread: number;
}

export function Navbar({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ivory-300 bg-ivory-50/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="shrink-0" aria-label="الطريقة السمّانية — السجادة السليمانية">
          <LogoLockup size={40} tone="light" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === l.href
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-brand-700/80 hover:bg-brand-50 hover:text-brand-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="بحث"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-700 hover:bg-brand-50"
          >
            <Icon.search width={20} height={20} />
          </Link>
          <Link href="/submit" className="btn-gold hidden sm:inline-flex">
            أرسل مادة
          </Link>
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/account/notifications"
                aria-label="الإشعارات"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-brand-700 hover:bg-brand-50"
              >
                <Icon.bell width={20} height={20} />
                {user.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {user.unread > 9 ? '9+' : user.unread}
                  </span>
                )}
              </Link>
              {isStaff(user.role) && (
                <Link href="/admin" className="btn-outline">
                  لوحة الإشراف
                </Link>
              )}
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs text-ivory-50">
                  {user.name.charAt(0)}
                </span>
                <span className="max-w-[7rem] truncate">{user.name}</span>
              </Link>
              <form action={logoutAction}>
                <button
                  className="flex h-10 items-center rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  title="تسجيل الخروج"
                >
                  خروج
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn-outline hidden sm:inline-flex">
              تسجيل الدخول
            </Link>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-700 hover:bg-brand-50 lg:hidden"
          >
            {open ? <Icon.x width={22} height={22} /> : <Icon.menu width={22} height={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-ivory-300 bg-ivory-50 lg:hidden">
          <nav className="container-page flex flex-col py-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-ivory-300 pt-3">
              <Link href="/submit" onClick={() => setOpen(false)} className="btn-gold">
                أرسل مادة
              </Link>
              {user ? (
                <>
                  {isStaff(user.role) && (
                    <Link href="/admin" onClick={() => setOpen(false)} className="btn-outline">
                      لوحة الإشراف
                    </Link>
                  )}
                  <Link href="/account" onClick={() => setOpen(false)} className="btn-ghost">
                    حسابي — {ROLE_LABELS[user.role as Role] ?? ''}
                  </Link>
                  <Link href="/account/notifications" onClick={() => setOpen(false)} className="btn-ghost">
                    الإشعارات {user.unread > 0 ? `(${user.unread})` : ''}
                  </Link>
                  <form action={logoutAction} className="w-full">
                    <button className="btn-outline w-full text-danger">تسجيل الخروج</button>
                  </form>
                </>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="btn-outline">
                  تسجيل الدخول
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
