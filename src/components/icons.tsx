import type { SVGProps } from 'react';

// Minimal stroke-icon set (24x24, currentColor). Keyed by name so categories
// can reference an icon by string.
type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const Icon = {
  search: (p: IconProps) => (
    <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  headphones: (p: IconProps) => (
    <svg {...base(p)}><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" /><path d="M3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /></svg>
  ),
  mic: (p: IconProps) => (
    <svg {...base(p)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" /></svg>
  ),
  'book-open': (p: IconProps) => (
    <svg {...base(p)}><path d="M12 7v14" /><path d="M3 18V5a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4a1 1 0 0 1-1-1Z" /></svg>
  ),
  users: (p: IconProps) => (
    <svg {...base(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  calendar: (p: IconProps) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  ),
  play: (p: IconProps) => (
    <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" /></svg>
  ),
  pause: (p: IconProps) => (
    <svg {...base(p)} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  ),
  download: (p: IconProps) => (
    <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
  ),
  share: (p: IconProps) => (
    <svg {...base(p)}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
  ),
  heart: (p: IconProps) => (
    <svg {...base(p)}><path d="M19 14c1.5-1.5 3-3.4 3-5.5A4.5 4.5 0 0 0 12 5.5 4.5 4.5 0 0 0 2 8.5c0 2.1 1.5 4 3 5.5l7 7Z" /></svg>
  ),
  menu: (p: IconProps) => (
    <svg {...base(p)}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
  ),
  x: (p: IconProps) => (
    <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  archive: (p: IconProps) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></svg>
  ),
  clock: (p: IconProps) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  file: (p: IconProps) => (
    <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>
  ),
  video: (p: IconProps) => (
    <svg {...base(p)}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8Z" /></svg>
  ),
  image: (p: IconProps) => (
    <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
  ),
  mapPin: (p: IconProps) => (
    <svg {...base(p)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
  ),
  user: (p: IconProps) => (
    <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  ),
  check: (p: IconProps) => (
    <svg {...base(p)}><path d="m20 6-11 11-5-5" /></svg>
  ),
  edit: (p: IconProps) => (
    <svg {...base(p)}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
  ),
  chevronLeft: (p: IconProps) => (
    <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>
  ),
  arrowLeft: (p: IconProps) => (
    <svg {...base(p)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
  ),
  bell: (p: IconProps) => (
    <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  ),
  chart: (p: IconProps) => (
    <svg {...base(p)}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
  ),
  flag: (p: IconProps) => (
    <svg {...base(p)}><path d="M4 21V4h13l-2 4 2 4H4" /></svg>
  ),
  sparkle: (p: IconProps) => (
    <svg {...base(p)}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /></svg>
  ),
  quote: (p: IconProps) => (
    <svg {...base(p)} fill="currentColor" stroke="none"><path d="M7 7h4v6a4 4 0 0 1-4 4H6v-2h1a2 2 0 0 0 2-2H7Zm8 0h4v6a4 4 0 0 1-4 4h-1v-2h1a2 2 0 0 0 2-2h-2Z" /></svg>
  ),
} as const;

export type IconName = keyof typeof Icon;

export function DynamicIcon({ name, ...props }: { name?: string | null } & Omit<IconProps, 'name'>) {
  const Cmp = (name && (Icon as Record<string, (p: IconProps) => JSX.Element>)[name]) || Icon.archive;
  return <Cmp {...props} />;
}
