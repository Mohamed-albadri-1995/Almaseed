// أرشيف المسيد — مسجّل الفيديوهات التعليمية (Playwright)
// يفتح الموقع الحقيقي، يمشي في كل تدفّق، ويسجّل فيديو mp4/webm لكل واحد،
// مع مؤشّر مرئي + هالة ذهبية حول الزر المطلوب + شريط تعليق عربي.
//
// التشغيل (على كمبيوتر يصل للموقع):
//   npm install
//   npx playwright install chromium
//   BASE_URL=https://almaseeed.com \
//   REVIEWER1_EMAIL=.. REVIEWER1_PASS=.. \
//   REVIEWER2_EMAIL=.. REVIEWER2_PASS=.. \
//   CONTRIBUTOR_EMAIL=.. CONTRIBUTOR_PASS=.. \
//   node record.mjs
//
// المخرجات في مجلد out/ — ملف لكل تدفّق.
// DRY_RUN=1 (الافتراضي): يقف قبل الأزرار التي تغيّر البيانات فعليًّا (نشر/رفض/حذف)
//   ويُبرزها فقط — آمن على الإنتاج. DRY_RUN=0 ينفّذ فعلًا (استخدم بيانات تجريبية).

import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = (process.env.BASE_URL || 'https://almaseeed.com').replace(/\/$/, '');
const DRY = process.env.DRY_RUN !== '0';
const OUT = 'out';
const SAMPLE = process.env.SAMPLE_FILE || 'sample.mp3'; // ملف صوت تجريبي صغير للرفع

const CRED = {
  reviewer1: [process.env.REVIEWER1_EMAIL, process.env.REVIEWER1_PASS],
  reviewer2: [process.env.REVIEWER2_EMAIL, process.env.REVIEWER2_PASS],
  contributor: [process.env.CONTRIBUTOR_EMAIL, process.env.CONTRIBUTOR_PASS],
};

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

const wait = (p, ms) => p.waitForTimeout(ms);
const say = (p, t) => p.evaluate((t) => window.__say && window.__say(t), t);

async function focus(page, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (b) await page.evaluate(([b]) => { window.__point(b.x + b.width / 2, b.y + b.height / 2); window.__ring({ x: b.x - 6, y: b.y - 6, w: b.width + 12, h: b.height + 12 }); }, [b]);
  await wait(page, 1300);
}
async function press(page, loc, caption, { destructive = false } = {}) {
  await say(page, caption);
  await focus(page, loc);
  if (destructive && DRY) { await say(page, caption + '  ⟵ (اضغط هنا) — [تجريبي: لم يُنفَّذ]'); await wait(page, 1600); return false; }
  await loc.click();
  await wait(page, 1200);
  return true;
}

async function login(ctx, role) {
  const [email, pass] = CRED[role] || [];
  const page = await ctx.newPage();
  await page.addInitScript(overlay);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await wait(page, 800);
  if (!email) { await say(page, 'لا توجد بيانات دخول لهذا الدور — تخطّي'); await wait(page, 1500); return page; }
  await say(page, 'اكتب البريد الإلكتروني');
  await focus(page, page.locator('#email')); await page.fill('#email', email);
  await say(page, 'اكتب كلمة المرور');
  await focus(page, page.locator('#password')); await page.fill('#password', pass);
  await press(page, page.getByRole('button', { name: 'دخول' }), 'اضغط «دخول»');
  await page.waitForLoadState('networkidle').catch(() => {});
  return page;
}

// كل تدفّق: { name, needs, run(ctx) } — يفتح سياقًا بتسجيل فيديو مستقل.
async function record(browser, name, run) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, locale: 'ar-SA',
    ignoreHTTPSErrors: true, recordVideo: { dir: OUT, size: { width: 412, height: 900 } },
  });
  await ctx.addInitScript(overlay);
  let page;
  try { page = await run(ctx); await wait(page, 1500); }
  catch (e) { console.log('  ⚠', name, '—', e.message.split('\n')[0]); }
  const pages = ctx.pages();
  await ctx.close();
  // إعادة تسمية آخر فيديو باسم التدفّق
  try {
    const vids = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
    // آخر فيديو أُنشئ لهذا السياق:
    const last = pages.map((p) => p.video()).filter(Boolean);
    if (last.length) { const src = await last[last.length - 1].path(); fs.renameSync(src, `${OUT}/${name}.webm`); }
    void vids;
  } catch {}
  console.log('  ✓', name);
}

async function openFirstSubmission(page, statusTab) {
  await page.goto(`${BASE}/admin/submissions?status=${statusTab}`, { waitUntil: 'networkidle' });
  await wait(page, 800);
  const link = page.getByRole('link', { name: 'تعديل' }).first();
  await press(page, link, 'افتح المادة من قائمة المراجعة');
  await page.waitForLoadState('networkidle').catch(() => {});
}

const FLOWS = {
  // 1) تسجيل الدخول
  '1-login': async (ctx) => {
    const page = await ctx.newPage(); await page.addInitScript(overlay);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await wait(page, 800);
    const [email, pass] = CRED.contributor;
    await say(page, 'صفحة تسجيل الدخول');
    if (email) { await focus(page, page.locator('#email')); await page.fill('#email', email);
      await focus(page, page.locator('#password')); await page.fill('#password', pass); }
    await press(page, page.getByRole('button', { name: 'دخول' }), 'اضغط «دخول»');
    return page;
  },
  // 2) رفع مادة
  '2-upload': async (ctx) => {
    const page = await login(ctx, 'contributor');
    await page.goto(`${BASE}/submit`, { waitUntil: 'networkidle' }); await wait(page, 900);
    await press(page, page.getByRole('button', { name: /المدائح/ }).first(), 'الخطوة ١: اختر نوع المادة (المدائح)');
    if (fs.existsSync(SAMPLE)) { await say(page, 'الخطوة ٢: ارفع الملف'); await page.setInputFiles('input[type=file]', SAMPLE).catch(() => {}); await wait(page, 2500); }
    await press(page, page.getByRole('button', { name: 'التالي' }).first(), 'اضغط «التالي»');
    await say(page, 'الخطوة ٣: اكتب العنوان'); await focus(page, page.locator('#title')); await page.fill('#title', 'مادة تجريبية — دليل').catch(() => {});
    await press(page, page.getByRole('button', { name: 'التالي' }).first(), 'اضغط «التالي»');
    await say(page, 'الخطوة ٤: فعّل الإقرارين'); await page.check('input[name=rightsConfirmed]').catch(() => {}); await page.check('input[name=reviewConsent]').catch(() => {}); await wait(page, 800);
    await press(page, page.getByRole('button', { name: 'إرسال للمراجعة' }), 'اضغط «إرسال للمراجعة»', { destructive: true });
    return page;
  },
  // 3) المراجعة — الرفض (تعليق)
  '3-review-reject': async (ctx) => {
    const page = await login(ctx, 'reviewer1');
    await openFirstSubmission(page, 'PENDING');
    await press(page, page.getByRole('button', { name: 'رفض المادة' }), 'في «قرار المراجعة» اختر «رفض المادة»');
    await say(page, 'اختر السبب (إلزامي)'); await page.selectOption('select[name=reason]', { index: 1 }).catch(() => {}); await wait(page, 900);
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار» — تصبح المادة معلّقة', { destructive: true });
    return page;
  },
  // 4) التثنية / نقض الرفض
  '4-second-review': async (ctx) => {
    const page = await login(ctx, 'reviewer2');
    await openFirstSubmission(page, 'HELD');
    await say(page, 'المراجع الثاني: للإتمام اضغط «رفض المادة»، أو للنقض «موافقة ونشر»');
    await focus(page, page.getByRole('button', { name: 'رفض المادة' }));
    await press(page, page.getByRole('button', { name: 'موافقة ونشر' }), 'مثال النقض: «موافقة ونشر» ثم «تأكيد القرار»');
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار»', { destructive: true });
    return page;
  },
  // 5) المراجعة — التعديل بنفسك
  '5-edit-self': async (ctx) => {
    const page = await login(ctx, 'reviewer1');
    await openFirstSubmission(page, 'PENDING');
    await say(page, 'عدّل الحقول في نموذج «بيانات المادة» مباشرةً');
    await focus(page, page.locator('#title'));
    await press(page, page.getByRole('button', { name: 'حفظ البيانات' }), 'اضغط «حفظ البيانات»', { destructive: true });
    return page;
  },
  // 6) المراجعة — طلب تعديل
  '6-request-edit': async (ctx) => {
    const page = await login(ctx, 'reviewer1');
    await openFirstSubmission(page, 'PENDING');
    await press(page, page.getByRole('button', { name: 'طلب تعديل' }), 'اختر «طلب تعديل»');
    await say(page, 'اختر السبب واكتب ملاحظة'); await page.selectOption('select[name=reason]', { index: 1 }).catch(() => {}); await wait(page, 900);
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار»', { destructive: true });
    return page;
  },
  // 7) المراجعة — القبول
  '7-approve': async (ctx) => {
    const page = await login(ctx, 'reviewer1');
    await openFirstSubmission(page, 'PENDING');
    await press(page, page.getByRole('button', { name: 'موافقة ونشر' }), 'اختر «موافقة ونشر»');
    await press(page, page.getByRole('button', { name: 'تأكيد القرار' }), 'اضغط «تأكيد القرار» — تُنشر المادة', { destructive: true });
    return page;
  },
  // 8) بدء تصويت حذف
  '8-delete-start': async (ctx) => {
    const page = await login(ctx, 'reviewer1');
    await page.goto(`${BASE}/admin/materials`, { waitUntil: 'networkidle' }); await wait(page, 900);
    await press(page, page.getByText('طلب حذف (تصويت القسم)').first(), 'افتح «طلب حذف (تصويت القسم)»');
    await say(page, 'اكتب سبب الحذف (اختياري)'); await page.fill('input[name=reason]', 'سبب تجريبي').catch(() => {}); await wait(page, 800);
    await press(page, page.getByRole('button', { name: 'فتح تصويت الحذف' }), 'اضغط «فتح تصويت الحذف»', { destructive: true });
    return page;
  },
  // 9) المشاركة في تصويت حذف
  '9-delete-vote': async (ctx) => {
    const page = await login(ctx, 'reviewer2');
    await page.goto(`${BASE}/admin/materials`, { waitUntil: 'networkidle' }); await wait(page, 900);
    await say(page, 'في لوحة «تصويتات حذف مفتوحة» بالأعلى');
    await press(page, page.getByRole('button', { name: 'أوافق على الحذف' }).first(), 'اضغط «أوافق على الحذف» (أو «أرفض الحذف»)', { destructive: true });
    return page;
  },
};

const only = process.argv[2]; // تشغيل تدفّق واحد اختياريًّا: node record.mjs 3-review-reject
(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log(`القاعدة: ${BASE} — الوضع: ${DRY ? 'تجريبي (لا يغيّر بيانات)' : 'تنفيذ فعلي'}`);
  for (const [name, run] of Object.entries(FLOWS)) {
    if (only && name !== only) continue;
    await record(browser, name, run);
  }
  await browser.close();
  console.log(`\nتمّ. الفيديوهات في مجلد ${OUT}/ (بصيغة webm). لتحويلها mp4: راجع README.`);
})();
