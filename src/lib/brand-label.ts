// Builds the السجادة "brand label" that is stamped onto downloadable media:
// the gold emblem, the contributor's name (اسم المساهم), and the site address
// (almaseeed.com), rendered as ONE transparent PNG with its opacity already
// baked in. The same PNG is reused for images, PDFs, video overlays, and audio
// cover art, so Arabic text is shaped correctly once (by sharp/librsvg) and we
// never rely on a PDF/ffmpeg text engine that can't shape Arabic.
//
// It is intentionally small and faint so it never distorts the material.

import { readFile } from 'fs/promises';
import { join } from 'path';

const SITE = 'almaseeed.com';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// The emblem as a data URI, read once and cached.
let emblemDataUri: Promise<string> | null = null;
function emblem(): Promise<string> {
  if (!emblemDataUri) {
    emblemDataUri = readFile(join(process.cwd(), 'public', 'logo.png')).then(
      (b) => `data:image/png;base64,${b.toString('base64')}`,
    );
  }
  return emblemDataUri;
}

// Cache built labels by contributor so repeated materials don't re-render.
const cache = new Map<string, Promise<Buffer>>();

/**
 * Render the brand label PNG (emblem + optional contributor name + site URL).
 * The result is a transparent PNG with baked-in opacity — composite/overlay it
 * directly (no further opacity handling needed).
 */
export function buildBrandLabel(contributor?: string | null): Promise<Buffer> {
  const name = (contributor || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const key = name || '__site__';
  const hit = cache.get(key);
  if (hit) return hit;
  const p = render(name);
  cache.set(key, p);
  return p;
}

async function render(name: string): Promise<Buffer> {
  const sharpMod = (await import('sharp')).default;
  const uri = await emblem();

  const W = 520;
  const EMB = 190; // emblem size (square logo)
  const embX = (W - EMB) / 2;
  const nameFont = 46;
  const siteFont = 36;

  let y = EMB + 22;
  const parts: string[] = [
    `<image href="${uri}" xlink:href="${uri}" x="${embX}" y="0" width="${EMB}" height="${EMB}" opacity="0.6"/>`,
  ];
  if (name) {
    y += nameFont;
    parts.push(
      `<text x="${W / 2}" y="${y}" font-size="${nameFont}" fill="#ffffff" fill-opacity="0.92" text-anchor="middle" direction="rtl" font-family="'Noto Naskh Arabic','Noto Sans Arabic','Amiri','DejaVu Sans',sans-serif" font-weight="600">${escapeXml(name)}</text>`,
    );
    y += 20;
  }
  y += siteFont;
  parts.push(
    `<text x="${W / 2}" y="${y}" font-size="${siteFont}" fill="#e8d9a0" fill-opacity="0.92" text-anchor="middle" font-family="'DejaVu Sans','Noto Sans',sans-serif" letter-spacing="1">${SITE}</text>`,
  );
  const H = y + 16;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${parts.join('')}</svg>`;
  return sharpMod(Buffer.from(svg)).png().toBuffer();
}
