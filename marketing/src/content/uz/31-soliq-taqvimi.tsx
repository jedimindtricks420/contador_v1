import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const TAX_TYPES = [
  "QQS (Qo’shilgan qiymat solig’i)",
  "Aylanma solig’i",
  "Foyda solig’i",
  "JShDS (Jismoniy shaxslardan olinadigan daromad solig’i)",
  "Ijtimoiy soliq",
  "Statistik hisobot",
];

const FREQUENCIES = [
  { label: "Har oy", desc: "Har oy topshiriladigan hisobotlar uchun." },
  { label: "Har chorak", desc: "Choraklik davriylikdagi hisobot va to’lovlar uchun." },
  { label: "Har yil", desc: "Yillik hisobot shakllari uchun." },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Contador soliq taqvimi — shaxsiy kabinetingiz ichidagi shaxsiy eslatmalar, Soliq yoki DSQ’ning rasmiy davlat taqvimi emas."
      />

      <section aria-labelledby="h2-taxes">
        <h2 id="h2-taxes" className="text-xl font-semibold text-black">
          Qaysi soliqlar kuzatiladi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Sozlamalarda quyidagi har bir hodisa turi uchun eslatma qoidasi yaratish mumkin:
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {TAX_TYPES.map((t) => (
            <li key={t} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h2-frequency">
        <h2 id="h2-frequency" className="text-xl font-semibold text-black">
          Eslatmalar davriyligi
        </h2>
        <p className="mt-3 text-sm text-gray-600">Har bir qoida uchun davriylik alohida ko’rsatiladi:</p>
        <ul className="mt-4 space-y-2">
          {FREQUENCIES.map((f) => (
            <li key={f.label} className="rounded border border-gray-200 p-3 text-sm">
              <span className="font-medium text-black">{f.label}</span>
              <span className="text-gray-600"> — {f.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h2-setup">
        <h2 id="h2-setup" className="text-xl font-semibold text-black">
          O’z muddatlaringizni qanday sozlash
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Har bir taqvim qoidasi uchun muddat to’g’ri keladigan oy sanasini o’zingiz ko’rsatasiz va qoidani
          yoqish yoki o’chirish mumkin. O’zbekistonda turli hisobot turlarining topshirish muddatlari bir-biridan
          farq qiladi va vaqti-vaqti bilan o’zgaradi — Contador siz uchun «to’g’ri» sanani standart bo’yicha
          qo’ymaydi.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Amaldagi talab va muddatlarni doim rasmiy manbalarda tekshiring — <span className="font-mono text-xs">soliq.uz</span> va{" "}
          <span className="font-mono text-xs">lex.uz</span>. Contador’dagi taqvim — sizga allaqachon ma’lum bo’lgan
          sanani unutmaslik uchun vosita, sananing o’zi uchun manba emas.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
