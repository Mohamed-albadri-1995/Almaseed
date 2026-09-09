import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  email: z.string().email('بريد إلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  city: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صحيح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export const submissionSchema = z.object({
  categorySlug: z.string().min(1, 'اختر نوع المادة'),
  title: z.string().min(2, 'العنوان مطلوب'),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  lyrics: z.string().optional(),
  summary: z.string().optional(),
  bodyText: z.string().optional(),
  performer: z.string().optional(),
  narrator: z.string().optional(),
  speaker: z.string().optional(),
  host: z.string().optional(),
  participants: z.string().optional(),
  occasion: z.string().optional(),
  topic: z.string().optional(),
  place: z.string().optional(),
  city: z.string().optional(),
  organizer: z.string().optional(),
  source: z.string().optional(),
  author: z.string().optional(),
  language: z.string().optional(),
  recordDate: z.string().optional(),
  keywords: z.string().optional(),
  fileUrl: z.string().optional(),
  fileKind: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.coerce.number().optional(),
  durationSec: z.coerce.number().optional(),
  coverImage: z.string().optional(),
  rightsConfirmed: z.union([z.literal('on'), z.literal('true'), z.boolean()]).refine((v) => v === 'on' || v === 'true' || v === true, { message: 'يجب الإقرار بحق مشاركة المادة' }),
  reviewConsent: z.union([z.literal('on'), z.literal('true'), z.boolean()]).refine((v) => v === 'on' || v === 'true' || v === true, { message: 'يجب الموافقة على المراجعة قبل النشر' }),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
