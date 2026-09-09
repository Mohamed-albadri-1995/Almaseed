'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { PdfViewer } from './PdfViewer';
import { formatDuration } from '@/lib/format';

interface Props {
  src?: string | null;
  kind?: string | null;
  title: string;
  poster?: string | null;
}

export function MediaPlayer({ src, kind, title, poster }: Props) {
  const isVideo = kind === 'VIDEO';
  const isImage = kind === 'IMAGE';
  const isDoc = kind === 'DOCUMENT';
  const ref = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrent(t);
  };

  const jump = (seconds: number) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.max(0, Math.min(duration || Infinity, el.currentTime + seconds));
    el.currentTime = next;
    setCurrent(next);
  };

  const changeRate = (value: number) => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = value;
    setRate(value);
  };

  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-500"><Icon.headphones width={26} height={26} /></span>
        <p className="text-sm font-medium text-brand-700">هذه مادة تجريبية ضمن العرض — لا يوجد ملف صوتي مرفوع بعد.</p>
        <p className="text-xs text-muted">عند رفع ملف حقيقي سيظهر هنا مشغّل التشغيل الكامل.</p>
      </div>
    );
  }

  if (isImage) {
    return <div className="overflow-hidden rounded-2xl bg-black/5"><img src={src} alt={title} className="max-h-[75vh] w-full rounded-2xl object-contain" /></div>;
  }

  if (isDoc) return <PdfViewer url={src} title={title} />;

  if (isVideo) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black">
        <video ref={ref as React.RefObject<HTMLVideoElement>} src={src} poster={poster ?? undefined} controls className="aspect-video w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-brand-800 p-5 text-ivory-50">
      <audio ref={ref as React.RefObject<HTMLAudioElement>} src={src} preload="metadata" />
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button type="button" onClick={() => jump(-15)} aria-label="تأخير 15 ثانية" title="تأخير 15 ثانية" className="flex h-11 min-w-16 items-center justify-center rounded-xl bg-brand-700 px-3 text-xs font-bold transition hover:bg-brand-600">↶ 15ث</button>
        <button type="button" onClick={toggle} aria-label={playing ? 'إيقاف' : 'تشغيل'} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-400 text-brand-900 transition hover:bg-gold-300">{playing ? <Icon.pause width={24} height={24} /> : <Icon.play width={24} height={24} />}</button>
        <button type="button" onClick={() => jump(15)} aria-label="تقديم 15 ثانية" title="تقديم 15 ثانية" className="flex h-11 min-w-16 items-center justify-center rounded-xl bg-brand-700 px-3 text-xs font-bold transition hover:bg-brand-600">15ث ↷</button>
        <label className="flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-3 text-xs font-bold">
          <span>السرعة</span>
          <select value={rate} onChange={(e) => changeRate(Number(e.target.value))} aria-label="سرعة التشغيل" className="rounded-lg bg-brand-800 px-2 py-1 text-ivory-50 outline-none">
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
      </div>
      <div className="mt-4">
        <p className="mb-2 truncate text-sm font-semibold">{title}</p>
        <input type="range" min={0} max={duration || 0} value={current} onChange={seek} className="w-full" aria-label="شريط التقدم" />
        <div className="mt-1 flex justify-between text-xs text-ivory-100/70"><span>{formatDuration(Math.floor(current))}</span><span>{formatDuration(Math.floor(duration))}</span></div>
      </div>
    </div>
  );
}
