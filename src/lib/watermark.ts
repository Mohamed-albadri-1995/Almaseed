// Small, non-destructive السجادة watermark applied by the background worker.
//
// • Images  → the brand label (emblem + المساهم name + site) in the bottom
//             corner (sharp).
// • PDFs    → the same label drawn small in the corner of every page (pdf-lib).
//
// Both are wrapped by the caller in try/catch: if watermarking ever fails the
// original file is used, so an upload never breaks because of the stamp. The
// label is pre-rendered once per material (see brand-label.ts) so Arabic text
// is shaped correctly and reused across images, PDFs, video, and audio art.

import { buildBrandLabel } from './brand-label';

// Which upload kinds get a burned-in visual stamp.
export function isWatermarkableImage(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext.toLowerCase());
}
export function isWatermarkablePdf(ext: string): boolean {
  return ext.toLowerCase() === 'pdf';
}

const IMG_SCALE = 0.30; // label width as a fraction of the image's short side
const IMG_MARGIN = 0.03; // corner padding as a fraction of the short side

// Stamp the brand label (emblem + المساهم name + site) in the bottom corner.
// `label` is the pre-rendered, already-faint PNG from buildBrandLabel; when
// omitted a site-only label is built.
export async function watermarkImage(input: Buffer, ext: string, label?: Buffer): Promise<Buffer> {
  const sharpMod = (await import('sharp')).default;
  const src = sharpMod(input, { failOn: 'none' });
  const meta = await src.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return input;

  const brand = label ?? (await buildBrandLabel(null));
  const shortSide = Math.min(width, height);
  const stampW = Math.max(120, Math.min(400, Math.round(shortSide * IMG_SCALE)));
  const stamp = await sharpMod(brand).resize({ width: stampW }).png().toBuffer();

  const stampMeta = await sharpMod(stamp).metadata();
  const stampH = stampMeta.height ?? stampW;
  const margin = Math.round(shortSide * IMG_MARGIN);
  const left = Math.max(0, width - stampW - margin);
  const top = Math.max(0, height - stampH - margin);

  let out = src.composite([{ input: stamp, left, top }]);
  const fmt = ext.toLowerCase();
  if (fmt === 'png') out = out.png();
  else if (fmt === 'webp') out = out.webp({ quality: 90 });
  else out = out.jpeg({ quality: 90 });
  return out.toBuffer();
}

export async function watermarkPdf(input: Buffer, label?: Buffer): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib');
  const brand = label ?? (await buildBrandLabel(null));
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true });
  const png = await pdf.embedPng(brand);
  const ratio = png.height / png.width;
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const w = Math.max(70, Math.min(150, width * 0.2));
    const h = w * ratio;
    const margin = Math.max(10, width * 0.02);
    page.drawImage(png, {
      x: width - w - margin,
      y: margin,
      width: w,
      height: h,
    });
  }
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
