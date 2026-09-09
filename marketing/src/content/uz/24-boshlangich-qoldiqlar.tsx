import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// guide turi, bloklar tartibi — TASK-0003 §6. Haqiqiy sahifa manzili —
// v2/src/app/settings/opening-balance (phase-1 evidence). Butun 1C bazasini
// avtomatik ko‘chirish haqida va’da berilmaydi — faqat bir martalik qo‘lda
// kiritish tasvirlanadi.
const CHECKLIST = [
  "Pul mablag‘lari: hisob boshlanish sanasidagi bank hisobvaraqlari va kassadagi qoldiqlar",
  "Xaridorlar va yetkazib beruvchilar bilan hisob-kitoblar: boshlanish sanasida yopilmagan summalar, har bir kontragent bo‘yicha",
  "Avanslar va hisobdor summalar: yopilmagan berilgan va olingan avanslar",
  "Ustav kapitali va boshqa o‘z kapitali moddalari boshlanish sanasida",
];

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Contador’da hisobni boshlashdan oldin boshlanish sanasini belgilang, kerakli hisobvaraqlar bo‘yicha qoldiqlarni shu sanaga yig‘ing va ularni «Boshlang‘ich qoldiqlar» sozlamalar bo‘limiga kiriting. Bu bir martalik qo‘lda kiritish, 1C bazasini avtomatik ko‘chirish emas."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-date" className="underline hover:text-black">Boshlanish sanasini tanlang</a></li>
          <li><a href="#h2-collect" className="underline hover:text-black">Hisobvaraqlar ma’lumotlarini yig‘ing</a></li>
          <li><a href="#h2-check" className="underline hover:text-black">Kiritilgan qoldiqlarni tekshiring</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-date">
        <h2 id="h2-date" className="text-xl font-semibold text-black">
          Boshlanish sanasini tanlang
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Boshlang‘ich qoldiqlar kabinetning «Boshlang‘ich qoldiqlar» sozlamalar bo‘limida kiritiladi. Boshlanish
          sanasi — Contador operatsiyalar bo‘yicha hisobni yurita boshlaydigan payt; undan oldingi barcha narsa
          faqat kiritilgan qoldiqlar orqali jamlangan holda aks etadi, alohida operatsiyalar bilan emas.
        </p>
      </section>


      <section aria-labelledby="h2-collect">
        <h2 id="h2-collect" className="text-xl font-semibold text-black">
          Hisobvaraqlar ma’lumotlarini yig‘ing
        </h2>
        <p className="mt-3 text-sm text-gray-600">Qoldiqlarni kiritishdan oldin har bir band bo‘yicha summalarni tayyorlang:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          Contador 1C bazasi yoki boshqa dasturni avtomatik ko‘chirmaydi — bu summalarni har bir hisobvaraq bo‘yicha
          alohida yig‘ish va qo‘lda kiritish kerak.
        </p>
      </section>

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Kiritilgan qoldiqlarni tekshiring
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Qoldiqlarni kiritgandan so‘ng ularni hisob boshlanish sanasidagi aylanma-saldo qaydnomasi va balans bilan
          solishtiring: hisobvaraqlar bo‘yicha yakuniy summalar oldingi bosqichda yig‘gan ma’lumotlaringizga mos
          kelishi kerak. Boshlang‘ich qoldiqlar kiritilmasa, balans va ASQ faqat Contador’da hisob boshlangandan
          keyin qo‘shilgan operatsiyalarni aks ettiradi.
        </p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
