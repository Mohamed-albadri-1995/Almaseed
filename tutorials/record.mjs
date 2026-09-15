// أرشيف المسيد — مسجّل الفيديوهات/اللقطات التعليمية (Playwright)
//
// وضعان:
//   MODE=video (الافتراضي): يسجّل فيديو webm لكل تدفّق (يحتاج playwright كامل — كمبيوتر).
//   MODE=shots            : يلتقط لقطة لكل خطوة ثم يدمجها mp4 بـffmpeg (يعمل على Termux/أندرويد).
//
// متغيّرات:
//   BASE_URL           عنوان الموقع (افتراضي https://almaseeed.com)
//   CHROMIUM_PATH      مسار متصفّح النظام (Termux: $PREFIX/bin/chromium) — لوضع shots
//   DRY_RUN=1          (افتراضي) آمن على الإنتاج: يقف قبل أزرار تغيير البيانات ويُبرزها فقط
//   REVIEWER1_EMAIL/REVIEWER1_PASS, REVIEWER2_*, CONTRIBUTOR_*   بيانات الدخول
//   SAMPLE_FILE        ملف تجريبي للرفع (افتراضي sample.mp3)
//
// أمثلة:
//   node record.mjs                      # كل التدفّقات، وضع فيديو
//   MODE=shots node record.mjs 3-review-reject   # تدفّق واحد، لقطات→mp4

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = (process.env.BASE_URL || 'https://almaseeed.com').replace(/\/$/, '');
const DRY = process.env.DRY_RUN !== '0';
const MODE = process.env.MODE === 'shots' ? 'shots' : 'video';
const OUT = 'out';
const SAMPLE = process.env.SAMPLE_FILE || 'sample.mp3';

const CRED = {
  reviewer1: [process.env.REVIEWER1_EMAIL, process.env.REVIEWER1_PASS],
  reviewer2: [process.env.REVIEWER2_EMAIL, process.env.REVIEWER2_PASS],
  contributor: [process.env.CONTRIBUTOR_EMAIL, process.env.CONTRIBUTOR_PASS],
};

// playwright الكامل للفيديو، وplaywright-core يكفي للّقطات (Termux).
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('playwright-core')); }

fs.mkdirSync(OUT, { recursive: true });

const overlay = `(function(){
  if(window.__tut)return; window.__tut=1;
  const mk=(s)=>{const e=document.createElement('div');Object.assign(e.style,s);return e;};
  const cur=mk({position:'fixed',zIndex:2147483647,width:'24px',height:'24px',pointerEvents:'none',transition:'left .5s ease,top .5s ease',left:'50%',top:'50%'});
  cur.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 2l6 16 2.6-6.6L19 9z" fill="#111" stroke="#fff" stroke-width="1.6"/></svg>';
  const cap=mk({position:'fixed',zIndex:2147483647,right:'14px',left:'14px',bottom:'18px',background:'rgba(31,61,51,.96)',color:'#fff',font:'700 17px Cairo,Tajawal,system-ui,sans-serif',padding:'13px 17px',borderRadius:'14px',textAlign:'right',direction:'rtl',boxShadow:'0 10px 34px rgba(0,0,0,.4)'});
  const halo=mk({position:'fixed',zIndex:2147483646,border:'3px solid #cd9b44',borderRadius:'12px',boxShadow:'0 0 0 4px rgba(205,155,68,.35)',pointerEvents:'none',transition:'all .35s ease',opacity:'0'});
  const add=()=>{[cur,cap,halo].forEach(e=>document.body.appendChild(e));};
  if(document.body)add(); else addEventListener('DOMContentLoaded',add);
  window.__say=(t)=>{cap.textContent=t;};
  window.__point=(x,y)=>{cur.style.left=x+'px';cur.style.top=y+'px';};
  window.__ring=(r)=>{ if(!r){halo.style.opacity='0';return;} halo.style.left=r.x+'px';halo.style.top=r.y+'px';halo.style.width=r.w+'px';halo.style.height=r.h+'px';halo.style.opacity='1'; };
})();`;

let CURRENT = '';
let STEP = 0;
const wait = (p, ms) => p.waitForTimeout(ms);
const say = (p, t) => p.evaluate((t) => window.__say && window.__say(t), t);

async function snap(page) {
  if (MODE !== 'shots') return;
  STEP += 1;
  fs.mkdirSync(`${OUT}/${CURRENT}`, { recursive: true });
  await page.screenshot({ path: `${OUT}/${CURRENT}/${String(STEP).padStart(3, '0')}.png` });
}
async function focus(page, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox().catch(() => null);
  if (b) await page.evaluate(([b]) => { window.__point(b.x + b.width / 2, b.y + b.height / 2); window.__ring({ x: b.x - 6, y: b.y - 6, w: b.width + 12, h: b.height + 12 }); }, [b]);
  await wait(page, 1200);
  await snap(page);
}
async function press(page, loc, caption, { destructive = false } = {}) {
  await say(page, caption);
  await focus(page, loc);
  if (destructive && DRY) { await say(page, caption + '  ⟵ (اضغط هنا) — [تجريبي: لم يُنفَّذ]'); await snap(page); await wait(page, 1200); return false; }
  await loc.click().catch(() => {});
  await wait(page, 1200);
  return true;
}

async function login(ctx, role) {
  const [email, pass] = CRED[role] || [];
  const page = await ctx.newPage(); await page.addInitScript(overlay);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await wait(page, 800);
  if (!email) { await say(page, 'لا توجد بيانات دخول لهذا الدور'); await snap(page); await wait(page, 1200); return page; }
  await say(page, 'اكتب البريد الإلكتروني'); await focus(page, page.locator('#email')); await page.fill('#email', email);
  await say(page, 'اكتب كلمة المرور'); await focus(page, page.locator('#password')); await page.fill('#password', pass);
  await press(page, page.getByRole('button', { name: 'دخول' }), 'اضغط «دخول»');
  await page.waitForLoadState('networkidle').catch(() => {});
  return page;
}
async function openFirstSubmission(page, statusTab) {
  await page.goto(`${BASE}/admin/submissions?status=${statusTab}`, { waitUntil: 'networkidle' }); await wait(page, 800);
  await press(page, page.getByRole('link', { name: 'تعديل' }).first(), 'افتح المادة من قائمة المراجعة');
  await page.waitForLoadState('networkidle').catch(() => {});
}

const FLOWS = {
  '1-login': async (ctx) => {
    const page = await ctx.newPage(); await page.addInitScript(overlay);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await wait(page, 800);
    const [email, pass] = CRED.contributor;
    await say(page, 'صفحة تسجيل الدخول'); await snap(page);
    if (email) { await focus(page, page.locator('#email')); await page.fill('#email', email); await focus(page, page.locator('#password')); await page.fill('#password', pass); }
    await press(page, page.getByRole('button', { name: 'دخول' }), 'اضغط «دخول»');
    return page;
  },
  '2-upload': async (ctx) => {
    const page = await login(ctx, 'contributor');
    await page.goto(`${BASE}/submit`, { waitUntil: 'networkidle' }); await wait(page, 900);
    await press(page, page.getByRole('button', { name: /المدائح/ }).first(), 'الخطوة ١: اختر نوع المادة (المدائح)');
    if (fs.existsSync(SAMPLE)) { await say(page, 'الخطوة ٢: ارفع الملف'); await page.setInputFiles('input[type=file]', SAMPLE).catch(() => {}); await wait(page, 2500); await snap(page); }
    await press(page, page.getByRole('button', { name: 'التالي' }).first(), 'اضغط «التالي»');
    await say(page, 'الخطوة ٣: اكتب العنوان'); await focus(page, page.locator('#title')); await page.fill('#title', 'مادة تجريبية — دليل').catch(() => {});
    await press(page, page.getByRole('button', { name: 'التالي' }).first(), 'اضغط «التالي»');
    await say(page, 'الخطوة ٤: فعّل الإقرارين'); await page.check('input[name=rightsConfirmed]').catch(() => {}); await page.check('input[name=reviewConsent]').catch(() => {}); await snap(page); await wait(page, 700);
    await press(page, page.getByRole('button', { name: 'إرسال للمراجعة' }), 'اضغط «إرسال للمراجعة»', { destructive: true });
    return page;
  },
  '3-review-reject': async (ctx) => {
    const page = await login(ctx, 'reviewer1'); await openFirstSubmission(page, 'PENDING');
    await press(page, page.getByRole('button', { name: 'رفض المادة' }), 'في «قرار المراجعة» اختر «رفض المادة»');
    await say(page, 'اختر السبب (إلزامي)'); await page.selectOption('select[name=reason]', { index: 1 }).catch(() => {}); await snap(page); await wait(page, 700);
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار» — تصبح المادة معلّقة', { destructive: true });
    return page;
  },
  '4-second-review': async (ctx) => {
    const page = await login(ctx, 'reviewer2'); await openFirstSubmission(page, 'HELD');
    await focus(page, page.getByRole('button', { name: 'رفض المادة' }));
    await press(page, page.getByRole('button', { name: 'موافقة ونشر' }), 'للنقض: «موافقة ونشر» (أو «رفض المادة» للإتمام)');
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار»', { destructive: true });
    return page;
  },
  '5-edit-self': async (ctx) => {
    const page = await login(ctx, 'reviewer1'); await openFirstSubmission(page, 'PENDING');
    await say(page, 'عدّل الحقول في نموذج «بيانات المادة»'); await focus(page, page.locator('#title'));
    await press(page, page.getByRole('button', { name: 'حفظ البيانات' }), 'اضغط «حفظ البيانات»', { destructive: true });
    return page;
  },
  '6-request-edit': async (ctx) => {
    const page = await login(ctx, 'reviewer1'); await openFirstSubmission(page, 'PENDING');
    await press(page, page.getByRole('button', { name: 'طلب تعديل' }), 'اختر «طلب تعديل»');
    await say(page, 'اختر السبب واكتب ملاحظة'); await page.selectOption('select[name=reason]', { index: 1 }).catch(() => {}); await snap(page); await wait(page, 700);
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار»', { destructive: true });
    return page;
  },
  '7-approve': async (ctx) => {
    const page = await login(ctx, 'reviewer1'); await openFirstSubmission(page, 'PENDING');
    await press(page, page.getByRole('button', { name: 'موافقة ونشر' }), 'اختر «موافقة ونشر»');
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار» — تُنشر المادة', { destructive: true });
    return page;
  },
  '8-delete-start': async (ctx) => {
    const page = await login(ctx, 'reviewer1');
    await page.goto(`${BASE}/admin/materials`, { waitUntil: 'networkidle' }); await wait(page, 900);
    await press(page, page.getByText('طلب حذف (تصويت القسم)').first(), 'افتح «طلب حذف (تصويت القسم)»');
    await say(page, 'اكتب سبب الحذف (اختياري)'); await page.fill('input[name=reason]', 'سبب تجريبي').catch(() => {}); await snap(page); await wait(page, 700);
    await press(page, page.getByRole('button', { name: 'فتح تصويت الحذف' }), 'اضغط «فتح تصويت الحذف»', { destructive: true });
    return page;
  },
  '9-delete-vote': async (ctx) => {
    const page = await login(ctx, 'reviewer2');
    await page.goto(`${BASE}/admin/materials`, { waitUntil: 'networkidle' }); await wait(page, 900);
    await say(page, 'في لوحة «تصويتات حذف مفتوحة» بالأعلى'); await snap(page);
    await press(page, page.getByRole('button', { name: 'أوافق على الحذف' }).first(), 'اضغط «أوافق على الحذف» (أو «أرفض الحذف»)', { destructive: true });
    return page;
  },
};

function stitch(name) {
  const dir = `${OUT}/${name}`;
  if (!fs.existsSync(dir)) return;
  const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  if (!frames.length) return;
  const list = `${dir}/frames.txt`;
  fs.writeFileSync(list, frames.map((f) => `file '${f}'\nduration 2.5`).join('\n') + `\nfile '${frames[frames.length - 1]}'\n`);
  try {
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-r', '30', '-movflags', '+faststart', `${OUT}/${name}.mp4`], { stdio: 'ignore' });
    console.log('  🎬', `${OUT}/${name}.mp4`);
  } catch { console.log('  (ffmpeg غير متوفّر — اللقطات في', dir, ')'); }
}

async function record(browser, name, run) {
  CURRENT = name; STEP = 0;
  const opts = { viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, locale: 'ar-SA', ignoreHTTPSErrors: true };
  if (MODE === 'video') opts.recordVideo = { dir: OUT, size: { width: 412, height: 900 } };
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(overlay);
  let page;
  try { page = await run(ctx); if (page) await wait(page, 1500); }
  catch (e) { console.log('  ⚠', name, '—', e.message.split('\n')[0]); }
  const vids = ctx.pages().map((p) => p.video()).filter(Boolean);
  await ctx.close();
  if (MODE === 'video') { try { if (vids.length) fs.renameSync(await vids[vids.length - 1].path(), `${OUT}/${name}.webm`); } catch {} }
  else stitch(name);
  console.log('  ✓', name);
}

const only = process.argv[2];
const launch = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
console.log(`القاعدة: ${BASE} — الوضع: ${MODE} — ${DRY ? 'تجريبي (آمن)' : 'تنفيذ فعلي'}`);
for (const [name, run] of Object.entries(FLOWS)) { if (only && name !== only) continue; await record(browser, name, run); }
await browser.close();
console.log(`\nتمّ. المخرجات في ${OUT}/`);
