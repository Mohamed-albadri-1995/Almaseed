# أرشيف المسيد — Task backlog

Requested changes to finish before/with the native app.

## Web app — content & forms
- [x] **About page:** tailored to الطريقة السمّانية / السجادة السليمانية (placeholder for owner's official text).
- [x] **Subtitle (عنوان فرعي):** added to every category (submit/edit/detail).
- [x] **New categories:** الصور (images) and المقروءات (readings) added.
- [x] **المقروءات two modes:** upload a file OR write an article (rendered as article).
- [x] **Form accuracy:** shared per-category field source (src/lib/fields.ts) — every form is now category-specific.

## Web app — submission flow
- [x] **Upload is the step BEFORE the fields.**
- [x] **Submission blocked until upload completes** (except readings article).
- [x] **Reject and delete free the storage** (file removed from R2).

## Web app — admin
- [x] **System-admin statistics:** visits + storage + memory (/admin/system).

## Native app (after web is finalized & confirmed)
- [ ] Simple app, one entry page with **three choices**:
  1. Login as **system admin (مشرف نظام)**
  2. Login as **contributor (مساهم)**
  3. **Media player only** — listen & download files (incl. written/readings), with two download options: **"تنزيل داخل التطبيق"** and **"تنزيل في الجهاز"** (pick a suitable name). Design befitting أرشيف المسيد.

## Infra / later
- [ ] Free but secure domain now; paid custom domain later.
- [ ] Switch Postgres to private URL (`postgres.railway.internal`) to cut egress.
- [ ] Point R2 to a custom domain (media.<domain>) once a domain exists.
