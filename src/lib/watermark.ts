// Small, non-destructive السجادة watermark applied to uploads at save time.
//
// • Images  → a small semi-transparent emblem in the bottom corner (sharp).
// • PDFs    → the same emblem drawn small in the corner of every page (pdf-lib).
//
// Both are wrapped by the caller in try/catch: if watermarking ever fails the
// original file is used, so an upload never breaks because of the stamp.
// Audio has no visual surface — it shows the emblem as artwork in the app's
// player instead (handled on the mobile side), so it isn't touched here.

import { readFile } from 'fs/promises';
import { join } from 'path';

// The gold emblem, transparent PNG (same asset used across web + app).
let emblemPromise: Promise<Buffer> | null = null;
function emblem(): Promise<Buffer> {
  if (!emblemPromise) {
    emblemPromise = readFile(join(process.cwd(), 'public', 'logo.png'));
  }
  return emblemPromise;
}

// Which upload kinds get a burned-in visual stamp.
export function isWatermarkableImage(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext.toLowerCase());
}
export function isWatermarkablePdf(ext: string): boolean {
  return ext.toLowerCase() === 'pdf';
}

const IMG_OPACITY = 0.42; // faint enough not to distort the material
const IMG_SCALE = 0.14; // logo width as a fraction of the image's short side
const IMG_MARGIN = 0.03; // corner padding as a fraction of the short side

export async function watermarkImage(input: Buffer, ext: string): Promise<Buffer> {
  const sharpMod = (await import('sharp')).default;
  const src = sharpMod(input, { failOn: 'none' });
  const meta = await src.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return input;

  const shortSide = Math.min(width, height);
  const logoW = Math.max(48, Math.min(260, Math.round(shortSide * IMG_SCALE)));

  // Resize the emblem and knock its opacity down to IMG_OPACITY. 'dest-in'
  // multiplies the emblem's alpha by the (uniform, low-alpha) mask.
  const alpha = Math.round(255 * IMG_OPACITY);
  const logo = await sharpMod(await emblem())
    .resize({ width: logoW })
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from([255, 255, 255, alpha]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const logoMeta = await sharpMod(logo).metadata();
  const logoH = logoMeta.height ?? logoW;
  const margin = Math.round(shortSide * IMG_MARGIN);
  const left = Math.max(0, width - logoW - margin);
  const top = Math.max(0, height - logoH - margin);

  let out = src.composite([{ input: logo, left, top }]);
  const fmt = ext.toLowerCase();
  if (fmt === 'png') out = out.png();
  else if (fmt === 'webp') out = out.webp({ quality: 90 });
  else out = out.jpeg({ quality: 90 });
  return out.toBuffer();
}

// A small emblem for PDF embedding — keeps documents from growing by the full
// ~460KB source PNG when we only draw it a few dozen points wide.
let pdfEmblemPromise: Promise<Buffer> | null = null;
function pdfEmblem(): Promise<Buffer> {
  if (!pdfEmblemPromise) {
    pdfEmblemPromise = (async () => {
      const sharpMod = (await import('sharp')).default;
      return sharpMod(await emblem()).resize({ width: 160 }).png().toBuffer();
    })();
  }
  return pdfEmblemPromise;
}

export async function watermarkPdf(input: Buffer): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true });
  const png = await pdf.embedPng(await pdfEmblem());
  const ratio = png.height / png.width;
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const w = Math.max(28, Math.min(72, width * 0.09));
    const h = w * ratio;
    const margin = Math.max(10, width * 0.02);
    page.drawImage(png, {
      x: width - w - margin,
      y: margin,
      width: w,
      height: h,
      opacity: 0.35,
    });
  }
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
