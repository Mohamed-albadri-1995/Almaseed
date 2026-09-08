import Link from 'next/link';
import { LogoLockup } from './Logo';

const COLS = [
  {
    title: 'الأرشيف',
    links: [
      { href: '/archive?category=madeeh', label: 'المدائح' },
      { href: '/archive?category=lectures', label: 'المحاضرات' },
      { href: '/archive?category=seminars', label: 'الندوات' },
      { href: '/archive?category=sermons', label: 'المواعظ' },
      { href: '/archive?category=occasions', label: 'المناسبات' },
    ],
  },
  {
    title: 'المنصة',
    links: [
      { href: '/about', label: 'عن الطريقة' },
      { href: '/submit', label: 'إرسال مادة' },
      { href: '/faq', label: 'الأسئلة الشائعة' },
      { href: '/contact', label: 'تواصل معنا' },
    ],
  },
  {
    title: 'السياسات',
    links: [
      { href: '/policy', label: 'شروط نشر المحتوى' },
      { href: '/policy#privacy', label: 'سياسة الخصوصية' },
      { href: '/policy#usage', label: 'سياسة الاستخدام' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-brand-800 text-ivory-100">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <LogoLockup size={44} tone="dark" />
            <p className="mt-4 max-w-xs text-sm leading-7 text-ivory-100/80">
              صوتٌ يُحفظ، وأثرٌ لا يغيب. نجمع المدائح والمحاضرات والندوات والمواعظ
              والمناسبات الخاصة بالطريقة السمّانية السجادة السليمانية في مكان واحد
              قريب من القلب.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-bold text-gold-300">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-ivory-100/80 transition-colors hover:text-ivory-50"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-brand-700 pt-6 text-sm text-ivory-100/70 sm:flex-row">
          <p>© {new Date().getFullYear()} الطريقة السمّانية — السجادة السليمانية — جميع الحقوق محفوظة.</p>
          <p className="text-gold-300">وقُل رَبِّ زِدْني عِلْمًا</p>
        </div>
      </div>
    </footer>
  );
}
