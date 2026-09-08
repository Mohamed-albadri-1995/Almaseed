# أرشيف المسيد — Task backlog

Requested changes to finish before/with the native app.

## Web app — content & forms
- [ ] **About page (عن الأرشيف):** tailor content to الطريقة السمّانية / السجادة السليمانية (specific order). Needs real wording from the owner.
- [ ] **Subtitle (عنوان فرعي):** add an optional subtitle field to every category, shown in submit/edit/detail.
- [ ] **New categories:** add **الصور** (images) and **المقروءات / الملفات المقروءة** (readings).
- [ ] **المقروءات** must support **two modes**: (a) upload a file, (b) write an article (typed text, shown as an article).
- [ ] **Form accuracy audit:** review/edit forms show irrelevant fields per category (e.g. "المادح" while reviewing محاضرات). Make every form strictly category-specific.

## Web app — submission flow
- [ ] **File upload must be a step BEFORE filling the fields.**
- [ ] **Reject submission if no file attached / upload not finished** (except المقروءات article mode).
- [ ] **On reject or delete, remove the file from storage** so it doesn't take space (delete already frees it; add the same on reject).

## Web app — admin
- [ ] **System-admin statistics:** visits/traffic + storage & memory usage.

## Native app (after web is finalized & confirmed)
- [ ] Simple app, one entry page with **three choices**:
  1. Login as **system admin (مشرف نظام)**
  2. Login as **contributor (مساهم)**
  3. **Media player only** — listen & download files (incl. written/readings), with two download options: **"تنزيل داخل التطبيق"** and **"تنزيل في الجهاز"** (pick a suitable name). Design befitting أرشيف المسيد.

## Infra / later
- [ ] Free but secure domain now; paid custom domain later.
- [ ] Switch Postgres to private URL (`postgres.railway.internal`) to cut egress.
- [ ] Point R2 to a custom domain (media.<domain>) once a domain exists.
