import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';

export const metadata: Metadata = { title: 'تواصل معنا' };

export default function ContactPage() {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <p className="eyebrow">نسعد بتواصلك</p>
          <h1 className="section-title mt-1">تواصل معنا</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            لأي استفسار أو اقتراح أو للإبلاغ عن مشكلة، اترك لنا رسالة وسنعود إليك.
          </p>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
