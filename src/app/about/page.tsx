import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/icons';

export const metadata: Metadata = { title: 'عن الطريقة السمّانية السجادة السليمانية' };

const VALUES = [
  { icon: 'archive' as const, title: 'حفظ دائم', body: 'نجمع المدائح والمحاضرات والندوات والمواعظ والمناسبات في مكان واحد يحميها من الضياع.' },
  { icon: 'check' as const, title: 'جودة مراجَعة', body: 'كل مادة تمر بدورة مراجعة قبل نشرها حفاظاً على دقة البيانات وسلامة المحتوى.' },
  { icon: 'users' as const, title: 'مساهمة مفتوحة', body: 'يستطيع الجميع المساهمة بمادة نافعة، والتصفّح والتنزيل متاحان دون قيود.' },
];

export default function AboutPage() {
  return (
    <div>
      <section className="bg-brand-800 py-16 text-ivory-50">
        <div className="container-page text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="شعار الطريقة السمّانية — السجادة السليمانية"
            width={104}
            height={104}
            className="mx-auto mb-5 h-24 w-24 drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
          />
          <p className="text-sm font-bold text-gold-300">من ذاكرة المسيد</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">
            عن الطريقة السمّانية
            <span className="mt-1 block text-3xl text-gold-300 sm:text-4xl">السجادة السليمانية</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl leading-8 text-ivory-100/85">
            أرشيفٌ رقمي يحفظ ذاكرة المسيد على نهج الطريقة السمّانية والسجادة
            السليمانية: مدائحها ومحاضراتها وندواتها ومواعظها ومناسباتها وصورها
            ومقروءاتها، منظّمةً ومتاحةً للجميع بما يليق بمكانتها.
          </p>
        </div>
      </section>

      <div className="container-page py-14">
        <div className="grid gap-6 sm:grid-cols-3">
          {VALUES.map((v) => {
            const IconCmp = Icon[v.icon];
            return (
              <div key={v.title} className="card p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                  <IconCmp width={24} height={24} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-brand-800">{v.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{v.body}</p>
              </div>
            );
          })}
        </div>

        {/* Official article — مسيد أبورخم */}
        <div className="mx-auto mt-14 max-w-3xl">
          <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/5">
            <div className="flex items-center gap-2 border-b border-ivory-200 bg-brand-800 px-6 py-4 text-ivory-50">
              <Icon.archive width={18} height={18} className="text-gold-300" />
              <span className="font-display text-lg font-bold">مسيد أبورخم</span>
            </div>
            <div className="article-prose px-6 py-8 sm:px-10 sm:py-10">
              <p>
                يعد مسيد أبورخم من المساجد والمسائد العريقة التي ارتبط تاريخها
                بتعليم القرآن الكريم وإقامة مجالس العلم والذكر والتربية، وقد توارثت
                أمانته أجيال متعاقبة من الأشراف، فاستمر عطاؤه وتواصلت رسالته في خدمة
                كتاب الله وأهله.
              </p>
              <p>
                وترجع نشأة مسيد أبورخم — بحسب ما توارثه أهل المسيد من الرواية
                والسند — إلى الشريف العبيد الحفيان الذي أسسه قبل عهد السلطنة الزرقاء،
                فكان تأسيسه إيذاناً بقيام موضع للقرآن والعلم والعبادة، ارتبط اسمه منذ
                ذلك العهد بخدمة الدين وتعليم الناشئة وتربية المريدين.
              </p>
              <p>
                وبعد انتقال مؤسسه للرفيق الأعلى، انتقلت أمانة المسيد إلى ابنه الشريف
                سليمان، فحمل راية والده وحافظ على نهج المسيد في تعليم القرآن وإقامة
                الذكر، وصان ما استقر فيه من تقاليد العلم والتربية.
              </p>
              <p>
                ثم آلت الخلافة إلى ابن أخيه الشريف سليمان بن الشريف إبراهيم، فواصل
                مسيرة من سبقه، وظل المسيد في عهده قائماً بوظيفته العلمية والدينية،
                محافظاً على إرثه المتوارث ومكانته في نفوس أهل المنطقة وطلاب القرآن.
              </p>
              <p>
                ثم خلفه ابنه الشريف زين العابدين، فتولى أمانة المسيد وحمل مسؤولية
                المحافظة على هذا الإرث، واستمر في أداء رسالته في القرآن والعلم والذكر
                والتربية، حتى انتقلت الخلافة من بعده إلى نجله وخليفته الحالي الذي
                تولى أمانة السجادة والمسيد، الأستاذ والمربي وخليفة الأشراف السبعة،
                فضيلة مولانا الشريف هارون الشريف زين العابدين — أطال الله عمره في
                طاعة الله وخدمة كتابه — حيث يواصل المسيرة التي بدأت بمؤسس المسيد
                الشريف العبيد الحفيان، وحملها من بعده خلفاؤه جيلاً بعد جيل.
              </p>
              <p>
                وبذلك يمثل مسيد أبورخم سلسلة متصلة من الخلافة والتعليم والتربية،
                امتدت عبر أجيال متعاقبة، وظلت فيها أمانة القرآن والعلم محفوظة
                ومتوارثة، ومقرونة باسم الأشراف الذين تعاقبوا على خدمته ورعايته.
              </p>
              <p>
                وإذا كان تاريخ المساجد والمسائد يقاس بما قامت به من أدوار في حياة
                الناس، فإن قيمة مسيد أبورخم لا تقتصر على قدم نشأته، وإنما تتمثل كذلك
                في استمرار رسالته وتوارث أمانته، وفي بقائه موضعاً للقرآن والعلم
                والذكر والتربية جيلاً بعد جيل.
              </p>
              <blockquote>
                نسأل الله تعالى أن يحفظ مسيد أبورخم، وأن يبارك في أهله وخلفائه، وأن
                يمد في عمر الشريف هارون الشريف زين العابدين ويعينه على أداء أمانته،
                وأن يجعل ما يقوم به من خدمة للقرآن وأهله امتداداً صالحاً لما أسسه
                الأجداد، وأن يحفظ لهذا المسيد رسالته ومكانته، ويجري الخير على يديه
                إلى ما شاء الله.
              </blockquote>
            </div>
          </div>

          {/* Contribute CTA */}
          <div className="mt-8 rounded-3xl border border-ivory-300 bg-ivory-50 p-6 text-center sm:p-8">
            <h2 className="text-xl font-bold text-brand-800">شارك في حفظ الإرث</h2>
            <p className="mx-auto mt-2 max-w-xl leading-8 text-ink/80">
              إن كنت تملك مادة نافعة — مدحة أو محاضرة أو ندوة أو موعظة أو توثيق
              مناسبة — يمكنك إرسالها ليتولى فريق المراجعة فحصها قبل نشرها في الأرشيف.
            </p>
            <Link href="/submit" className="btn-primary mt-5">
              أرسل مادة للأرشيف
              <Icon.arrowLeft width={18} height={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
