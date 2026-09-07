import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  CATEGORIES_SEED,
  CATEGORY_SLUGS,
  MATERIAL_STATUS,
  FILE_KINDS,
  ROLES,
} from '../src/lib/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding أرشيف المسيد …');

  // ---- Categories ---------------------------------------------------------
  for (const c of CATEGORIES_SEED) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        order: c.order,
      },
      create: { ...c },
    });
  }
  const categories = await prisma.category.findMany();
  const bySlug = (slug: string) => categories.find((c) => c.slug === slug)!;

  // ---- Users --------------------------------------------------------------
  const pw = await bcrypt.hash('password123', 10);
  const users = [
    { name: 'مدير النظام', email: 'admin@almaseed.app', role: ROLES.ADMIN, city: 'أم درمان' },
    { name: 'مدير المحتوى', email: 'manager@almaseed.app', role: ROLES.CONTENT_MANAGER, city: 'الخرطوم' },
    { name: 'المحرر', email: 'editor@almaseed.app', role: ROLES.EDITOR, city: 'ود مدني' },
    { name: 'المراجع', email: 'reviewer@almaseed.app', role: ROLES.REVIEWER, city: 'كسلا' },
    { name: 'عبدالله المساهم', email: 'contributor@almaseed.app', role: ROLES.CONTRIBUTOR, city: 'بورتسودان' },
  ];
  const userRecords: Record<string, string> = {};
  for (const u of users) {
    const rec = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, city: u.city },
      create: { ...u, passwordHash: pw },
    });
    userRecords[u.role] = rec.id;
  }
  const contributorId = userRecords[ROLES.CONTRIBUTOR];
  const reviewerId = userRecords[ROLES.REVIEWER];

  // Only reseed materials on a clean database to avoid duplicates.
  const existing = await prisma.material.count();
  if (existing > 0) {
    console.log(`↳ Materials already present (${existing}) — skipping material seed.`);
    console.log('✅ Seed complete.');
    return;
  }

  const days = (n: number) => new Date(Date.now() - n * 86400000);

  type Seed = {
    title: string;
    slug: string;
    status?: string;
    fileKind?: string;
    fileType?: string;
    fileSize?: number;
    durationSec?: number;
    performer?: string;
    narrator?: string;
    speaker?: string;
    host?: string;
    participants?: string;
    occasion?: string;
    topic?: string;
    place?: string;
    city?: string;
    organizer?: string;
    description?: string;
    lyrics?: string;
    summary?: string;
    keywords?: string;
    recordDate?: Date;
    downloads?: number;
    plays?: number;
    createdAt?: Date;
    submittedBy?: string;
  };

  const materials: Seed[] = [
    // ---- المدائح ----
    {
      title: 'يا راحلين إلى منى',
      slug: CATEGORY_SLUGS.MADEEH,
      performer: 'الشيخ محمد عثمان',
      narrator: 'أحمد الطيب',
      occasion: 'مولد نبوي',
      place: 'مسيد ود بدر',
      city: 'أم درمان',
      durationSec: 1080,
      fileType: 'MP3',
      fileSize: 12 * 1024 * 1024,
      downloads: 1840,
      plays: 5230,
      keywords: 'مدح، مولد، إنشاد',
      description: 'مدحة نبوية في حب المصطفى صلى الله عليه وسلم أُنشدت في ليلة المولد.',
      lyrics: 'يا راحلين إلى منى بقيادي\nهيّجتمُ يوم الرحيل فؤادي',
      recordDate: days(40),
      createdAt: days(3),
    },
    {
      title: 'طلع البدر علينا',
      slug: CATEGORY_SLUGS.MADEEH,
      performer: 'منشد المسيد',
      occasion: 'استقبال',
      place: 'المسيد الكبير',
      city: 'الخرطوم',
      durationSec: 540,
      fileType: 'MP3',
      fileSize: 6 * 1024 * 1024,
      downloads: 3120,
      plays: 9800,
      keywords: 'بدر، استقبال، نشيد',
      description: 'من أشهر المدائح النبوية في استقبال المناسبات.',
      recordDate: days(120),
      createdAt: days(10),
    },
    {
      title: 'قصيدة البردة',
      slug: CATEGORY_SLUGS.MADEEH,
      performer: 'جماعة الإنشاد',
      narrator: 'الإمام البوصيري',
      occasion: 'مجلس ذكر',
      place: 'مسيد الشيخ',
      durationSec: 2400,
      fileType: 'MP3',
      fileSize: 28 * 1024 * 1024,
      downloads: 980,
      plays: 2600,
      status: MATERIAL_STATUS.PENDING,
      submittedBy: contributorId,
      description: 'إلقاء كامل لقصيدة البردة الشريفة.',
      createdAt: days(1),
    },

    // ---- المحاضرات ----
    {
      title: 'آداب طالب العلم',
      slug: CATEGORY_SLUGS.LECTURES,
      speaker: 'د. الطيب الحسن',
      topic: 'التربية والتعليم',
      place: 'قاعة المحاضرات',
      city: 'ود مدني',
      durationSec: 3300,
      fileType: 'MP3',
      fileSize: 40 * 1024 * 1024,
      downloads: 640,
      plays: 1900,
      keywords: 'علم، أدب، طلب العلم',
      summary: 'محاضرة حول الأخلاق والآداب التي ينبغي لطالب العلم التحلي بها.',
      recordDate: days(60),
      createdAt: days(5),
    },
    {
      title: 'فقه الأولويات في حياة المسلم',
      slug: CATEGORY_SLUGS.LECTURES,
      speaker: 'الشيخ عبدالرحيم',
      host: 'مقدم البرنامج',
      topic: 'الفقه',
      place: 'المركز الثقافي',
      durationSec: 4200,
      fileType: 'MP4',
      fileKind: FILE_KINDS.VIDEO,
      fileSize: 220 * 1024 * 1024,
      downloads: 410,
      plays: 1250,
      summary: 'كيف يرتّب المسلم أولوياته وفق مقاصد الشريعة.',
      recordDate: days(90),
      createdAt: days(12),
    },
    {
      title: 'سلسلة شرح الأربعين النووية',
      slug: CATEGORY_SLUGS.LECTURES,
      speaker: 'د. أحمد النور',
      topic: 'الحديث',
      status: MATERIAL_STATUS.NEEDS_EDIT,
      submittedBy: contributorId,
      durationSec: 3600,
      fileType: 'MP3',
      fileSize: 44 * 1024 * 1024,
      summary: 'الدرس الأول من سلسلة شرح متن الأربعين النووية.',
      createdAt: days(2),
    },

    // ---- المواعظ ----
    {
      title: 'موعظة في الرقائق',
      slug: CATEGORY_SLUGS.SERMONS,
      speaker: 'الشيخ إبراهيم',
      topic: 'الرقائق',
      place: 'المسجد الجامع',
      durationSec: 1500,
      fileType: 'MP3',
      fileSize: 18 * 1024 * 1024,
      downloads: 520,
      plays: 1600,
      keywords: 'موعظة، قلوب، رقائق',
      description: 'كلمات تلامس القلب في تزكية النفس وإصلاح القلب.',
      recordDate: days(30),
      createdAt: days(6),
    },
    {
      title: 'خطبة عن بر الوالدين',
      slug: CATEGORY_SLUGS.SERMONS,
      speaker: 'خطيب الجامع',
      topic: 'الأسرة',
      durationSec: 1200,
      fileType: 'MP3',
      fileSize: 14 * 1024 * 1024,
      downloads: 730,
      plays: 2100,
      description: 'خطبة جمعة في فضل بر الوالدين وصلة الرحم.',
      recordDate: days(20),
      createdAt: days(8),
    },

    // ---- الندوات ----
    {
      title: 'ندوة: دور المسيد في حفظ التراث',
      slug: CATEGORY_SLUGS.SEMINARS,
      host: 'د. عمر الأمين',
      participants: 'الشيخ محمد، د. الطيب، أ. فاطمة',
      topic: 'التراث والثقافة',
      occasion: 'أسبوع التراث',
      place: 'قاعة الندوات',
      city: 'الخرطوم',
      durationSec: 5400,
      fileType: 'MP4',
      fileKind: FILE_KINDS.VIDEO,
      fileSize: 320 * 1024 * 1024,
      downloads: 260,
      plays: 780,
      description: 'حوار فكري حول دور المسيد التاريخي في حفظ العلم والتراث.',
      recordDate: days(15),
      createdAt: days(4),
    },
    {
      title: 'لقاء حول التعليم الأهلي',
      slug: CATEGORY_SLUGS.SEMINARS,
      host: 'مدير الندوة',
      participants: 'نخبة من الأساتذة',
      topic: 'التعليم',
      status: MATERIAL_STATUS.PENDING,
      submittedBy: contributorId,
      durationSec: 4800,
      fileType: 'MP3',
      fileSize: 55 * 1024 * 1024,
      description: 'ندوة حول تجربة التعليم الأهلي والخلاوى.',
      createdAt: days(1),
    },

    // ---- المناسبات ----
    {
      title: 'احتفال ذكرى تأسيس المسيد',
      slug: CATEGORY_SLUGS.OCCASIONS,
      organizer: 'إدارة المسيد',
      participants: 'أهل المسيد والزوار',
      occasion: 'ذكرى التأسيس',
      place: 'ساحة المسيد',
      city: 'أم درمان',
      durationSec: 7200,
      fileType: 'MP4',
      fileKind: FILE_KINDS.VIDEO,
      fileSize: 480 * 1024 * 1024,
      downloads: 190,
      plays: 610,
      keywords: 'احتفال، ذكرى، مسيد',
      description: 'توثيق لاحتفالية ذكرى تأسيس المسيد بمشاركة واسعة.',
      recordDate: days(200),
      createdAt: days(9),
    },
    {
      title: 'ختام الدورة الصيفية لحفظ القرآن',
      slug: CATEGORY_SLUGS.OCCASIONS,
      organizer: 'لجنة التحفيظ',
      occasion: 'حفل ختام',
      place: 'قاعة الاحتفالات',
      durationSec: 3600,
      fileType: 'MP3',
      fileSize: 42 * 1024 * 1024,
      downloads: 140,
      plays: 430,
      status: MATERIAL_STATUS.REJECTED,
      submittedBy: contributorId,
      description: 'حفل تكريم الطلاب الحافظين في ختام الدورة الصيفية.',
      createdAt: days(14),
    },
  ];

  for (const m of materials) {
    const status = m.status ?? MATERIAL_STATUS.PUBLISHED;
    const cat = bySlug(m.slug);
    const created = await prisma.material.create({
      data: {
        title: m.title,
        status,
        categoryId: cat.id,
        description: m.description,
        lyrics: m.lyrics,
        summary: m.summary,
        performer: m.performer,
        narrator: m.narrator,
        speaker: m.speaker,
        host: m.host,
        participants: m.participants,
        occasion: m.occasion,
        topic: m.topic,
        place: m.place,
        city: m.city,
        organizer: m.organizer,
        keywords: m.keywords,
        recordDate: m.recordDate,
        fileKind: m.fileKind ?? FILE_KINDS.AUDIO,
        fileType: m.fileType,
        fileSize: m.fileSize,
        durationSec: m.durationSec,
        downloads: m.downloads ?? 0,
        plays: m.plays ?? 0,
        source: 'أرشيف المسيد',
        submittedById: m.submittedBy ?? null,
        reviewedById: status === MATERIAL_STATUS.PUBLISHED ? reviewerId : null,
        publishedAt: status === MATERIAL_STATUS.PUBLISHED ? m.createdAt ?? new Date() : null,
        createdAt: m.createdAt ?? new Date(),
      },
    });

    // Add a review note for non-pending, submitted items to illustrate workflow.
    if (m.submittedBy && status === MATERIAL_STATUS.NEEDS_EDIT) {
      await prisma.reviewNote.create({
        data: {
          materialId: created.id,
          reviewerId,
          action: 'REQUEST_EDIT',
          reason: 'بيانات ناقصة',
          note: 'يرجى إضافة اسم المكان وتاريخ التسجيل قبل إعادة الإرسال.',
        },
      });
    }
    if (m.submittedBy && status === MATERIAL_STATUS.REJECTED) {
      await prisma.reviewNote.create({
        data: {
          materialId: created.id,
          reviewerId,
          action: 'REJECT',
          reason: 'جودة الملف ضعيفة',
          note: 'جودة التسجيل الصوتي منخفضة جداً ولا تصلح للنشر.',
        },
      });
    }
  }

  console.log(`✅ Seed complete: ${materials.length} materials, ${users.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
