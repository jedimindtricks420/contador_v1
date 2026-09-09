import { Hero } from "@/components/marketing/Hero";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

const FORM_LINES = [
  { code: "010", label: "Jami daromad" },
  { code: "020", label: "Chegiriladigan xarajatlar" },
  { code: "062", label: "Soliq bazasi" },
  { code: "080", label: "N% stavka bo’yicha soliq", note: "предварительно, до подтверждения" },
];

const QUARTERS = [
  "I chorak",
  "II chorak (yarim yil)",
  "III chorak (9 oy)",
  "IV chorak (yil)",
];

const STATUSES = [
  { label: "Заполнено", desc: "ma’lumot kiritilgan va hisoblangan" },
  { label: "Требует проверки", desc: "topshirishdan oldin qo’lda tekshirish kerak" },
  { label: "Только годовой отчёт", desc: "ilova faqat yillik hisobotga tegishli" },
  { label: "Не применимо (0)", desc: "ko’rsatkich joriy davrga tegishli emas" },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Hisob my.soliq.uz shaklini aks ettiradi: jami daromaddan soliq summasigacha, yil boshidan o’sish yig’indisi bilan."
      />

      <section aria-labelledby="h2-structure">
        <h2 id="h2-structure" className="text-xl font-semibold text-black">
          Hisob nimalardan tashkil topadi
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Asosiy shakl hisob ma’lumotlaringiz bo’yicha hisoblangan to’rtta asosiy ko’rsatkichni ko’rsatadi. Real
          shakldagi kod va nom rus tilida saqlanadi — my.soliq.uz portalidagi rasmiy shaklga mos kelishi uchun:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                <th className="py-2 pr-4 font-medium">Kod</th>
                <th className="py-2 font-medium">Ko’rsatkich</th>
              </tr>
            </thead>
            <tbody>
              {FORM_LINES.map((l) => (
                <tr key={l.code} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">{l.code}</td>
                  <td className="py-2 text-gray-700">
                    {l.label}
                    {l.note && <span className="ml-2 text-xs text-amber-700">({l.note})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          «N% stavka bo’yicha soliq» qiymati «предварительно, до подтверждения» deb belgilangan — bu kiritilgan
          ma’lumotlar asosidagi avtomatik hisob bo’lib, yakuniy deb hisoblashdan oldin tekshirish kerak.
        </p>
      </section>

      <section aria-labelledby="h2-quarters">
        <h2 id="h2-quarters" className="text-xl font-semibold text-black">
          Choraklar va hisobot davrlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">To’rtta hisobot davri mavjud, har biri yil boshidan o’sish yig’indisi bilan:</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {QUARTERS.map((q) => (
            <li key={q} className="rounded border border-gray-200 p-3 text-sm text-gray-700">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Topshirishdan oldin tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">Har bir hisob ilovasining tayyorlik holati bor:</p>
        <ul className="mt-4 space-y-2">
          {STATUSES.map((s) => (
            <li key={s.label} className="rounded border border-gray-200 p-3 text-sm">
              <span className="font-medium text-black">{s.label}</span>
              <span className="text-gray-600"> — {s.desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          Contador my.soliq.uz shakliga o’xshash formatda ma’lumotlarni tayyorlaydi va oldindan hisoblaydi —
          hisobotning o’zini har doim portalda mustaqil topshirasiz, servis uni yubormaydi.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
